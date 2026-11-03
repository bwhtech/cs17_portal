from collections import Counter
from typing import TYPE_CHECKING

import frappe
from frappe import _
from frappe.utils import (
	add_to_date,
	cint,
	flt,
	format_datetime,
	get_datetime,
	get_url,
	now_datetime,
	time_diff_in_seconds,
)

from cs17_portal.api import (
	ASSIGNMENT_SUBMISSION,
	get_cohort_students,
	get_current_faculty,
	is_published_now,
	require_current_student,
	start_python_assignment,
)
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	AUTO_SUBMIT_GRACE_SECONDS,
)
from cs17_portal.exam_seb import require_safe_exam_browser

if TYPE_CHECKING:
	from datetime import datetime

	from frappe.model.document import Document

CODING_EXAM = "CS17 Coding Exam"
ATTEMPT = "CS17 Coding Exam Attempt"
PASSED = ("submitted", "skipped")


@frappe.whitelist(methods=["GET"])
def get_my_coding_exams() -> list:
	student = require_current_student()
	exams = frappe.get_all(
		CODING_EXAM,
		filters={"cohort": frappe.db.get_value("CS17 Profile", student, "cohort"), "is_published": 1},
		fields=["name", "title", "opens_on", "last_start_on", "closes_on", "duration_minutes"],
		order_by="opens_on desc",
	)
	finished_on = dict(
		frappe.get_all(
			ATTEMPT,
			filters={"student": student, "exam": ["in", [exam.name for exam in exams]]},
			fields=["exam", "finished_on"],
			as_list=True,
		)
	)
	now = now_datetime()
	for exam in exams:
		if exam.name in finished_on:
			exam.state = "finished" if finished_on[exam.name] else "in_progress"
		elif now < exam.opens_on:
			exam.state = "upcoming"
		elif now <= exam.last_start_on:
			exam.state = "open"
		else:
			exam.state = "closed"
	return exams


@frappe.whitelist(methods=["GET"])
def get_my_coding_exam(exam: str) -> dict:
	student = require_current_student()
	exam_doc = get_student_exam(exam, student)
	require_safe_exam_browser(exam)
	attempt = get_attempt_doc(exam, student)
	if attempt and not attempt.finished_on:
		from cs17_portal.exam_activity import record_second_login

		record_second_login(exam, student, attempt.started_at)
	return {
		"name": exam_doc.name,
		"title": exam_doc.title,
		"instructions": exam_doc.instructions,
		"duration_minutes": exam_doc.duration_minutes,
		"opens_on": exam_doc.opens_on,
		"last_start_on": exam_doc.last_start_on,
		"closes_on": exam_doc.closes_on,
		"question_order": exam_doc.question_order,
		"can_go_back": exam_doc.can_go_back,
		"banner": exam_doc.banner,
		"now": now_datetime(),
		"attempt": attempt and attempt_details(attempt, exam_doc.closes_on),
		"questions": get_questions(exam_doc, attempt) if attempt else [],
		"rules": {
			"require_fullscreen": exam_doc.require_fullscreen,
			"count_window_switches": exam_doc.count_window_switches,
			"paste_rule": exam_doc.paste_rule,
			"watch_copy": exam_doc.watch_copy,
		},
	}


@frappe.whitelist(methods=["POST"])
def start_coding_exam(exam: str) -> dict:
	student = require_current_student()
	exam_doc = get_student_exam(exam, student)
	require_safe_exam_browser(exam)
	now = now_datetime()
	if now < get_datetime(exam_doc.opens_on):
		frappe.throw(_("This exam is not open yet."))
	if now > get_datetime(exam_doc.last_start_on):
		frappe.throw(_("The last start time for this exam has passed."))
	if frappe.db.exists(ATTEMPT, {"exam": exam, "student": student}):
		frappe.throw(_("You have already started this exam."))
	attempt = frappe.get_doc({"doctype": ATTEMPT, "exam": exam, "student": student, "started_at": now})
	attempt.insert(ignore_permissions=True)
	return attempt_details(attempt, exam_doc.closes_on)


@frappe.whitelist(methods=["POST"])
def open_exam_question(exam: str, assignment: str) -> dict:
	student = require_current_student()
	exam_doc = get_student_exam(exam, student)
	require_safe_exam_browser(exam)
	attempt = get_attempt_doc(exam, student)
	if not attempt or attempt.finished_on:
		frappe.throw(attempt_closed_reason(attempt))
	question = get_exam_question(exam_doc, attempt, assignment)
	if question.is_locked:
		frappe.throw(_("This question is locked."))
	return {"project": question.project or start_python_assignment(assignment)["name"]}


@frappe.whitelist(methods=["POST"])
def skip_exam_question(exam: str, assignment: str) -> None:
	student = require_current_student()
	exam_doc = get_student_exam(exam, student)
	require_safe_exam_browser(exam)
	if exam_doc.question_order != "One by one":
		frappe.throw(_("Questions can be skipped only in a one by one exam."))
	attempt = get_attempt_doc(exam, student)
	if reason := attempt_closed_reason(attempt):
		frappe.throw(reason)
	question = get_exam_question(exam_doc, attempt, assignment)
	if question.is_locked or question.state in PASSED:
		frappe.throw(_("Only the question you are on can be skipped."))
	progress_row(attempt, assignment).skipped_on = now_datetime()
	attempt.save(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def finish_coding_exam(exam: str) -> None:
	student = require_current_student()
	get_student_exam(exam, student)
	require_safe_exam_browser(exam)
	attempt = get_attempt_doc(exam, student)
	if reason := attempt_closed_reason(attempt):
		frappe.throw(reason)
	attempt.finish()


@frappe.whitelist(methods=["GET"])
def get_coding_exams() -> list:
	faculty = get_current_faculty()
	exams = frappe.get_all(
		CODING_EXAM,
		filters={"cohort": faculty.cohort} if faculty.cohort else {},
		fields=[
			"name",
			"title",
			"cohort",
			"quarter",
			"opens_on",
			"last_start_on",
			"closes_on",
			"duration_minutes",
			"is_published",
		],
		order_by="opens_on desc",
	)
	question_counts = Counter(
		frappe.get_all(
			"CS17 Coding Exam Question",
			filters={"parent": ["in", [exam.name for exam in exams]], "parenttype": CODING_EXAM},
			pluck="parent",
		)
	)
	now = now_datetime()
	for exam in exams:
		exam.question_count = question_counts[exam.name]
		if not exam.is_published:
			exam.state = "draft"
		elif now < exam.opens_on:
			exam.state = "upcoming"
		elif now <= exam.closes_on:
			exam.state = "open"
		else:
			exam.state = "closed"
	return exams


@frappe.whitelist(methods=["GET"])
def get_coding_exam(exam: str) -> dict:
	exam_doc = require_faculty_exam(exam)
	assignments = {
		assignment.name: assignment
		for assignment in frappe.get_all(
			"CS17 Assignment",
			filters={"name": ["in", [row.assignment for row in exam_doc.questions]]},
			fields=["name", "title", "max_marks"],
		)
	}
	return {
		"name": exam_doc.name,
		"title": exam_doc.title,
		"cohort": exam_doc.cohort,
		"quarter": exam_doc.quarter,
		"instructions": exam_doc.instructions,
		"duration_minutes": exam_doc.duration_minutes,
		"opens_on": exam_doc.opens_on,
		"last_start_on": exam_doc.last_start_on,
		"closes_on": exam_doc.closes_on,
		"question_order": exam_doc.question_order,
		"can_go_back": exam_doc.can_go_back,
		"banner": exam_doc.banner,
		"require_fullscreen": exam_doc.require_fullscreen,
		"count_window_switches": exam_doc.count_window_switches,
		"paste_rule": exam_doc.paste_rule,
		"watch_copy": exam_doc.watch_copy,
		"leave_limit": exam_doc.leave_limit,
		"leave_seconds": exam_doc.leave_seconds,
		"leave_action": exam_doc.leave_action,
		"alert_kinds": exam_doc.alert_kinds,
		"require_seb": exam_doc.require_seb,
		"has_seb_key": bool(exam_doc.seb_browser_exam_key),
		"is_published": exam_doc.is_published,
		"has_attempts": bool(frappe.db.exists(ATTEMPT, {"exam": exam})),
		"seb_start_url": get_url(f"/dashboard/exams/{exam}"),
		"questions": [
			{
				"assignment": row.assignment,
				"title": assignments[row.assignment].title,
				"marks": row.marks,
				"max_marks": assignments[row.assignment].max_marks,
			}
			for row in exam_doc.questions
		],
		"changes": frappe.get_all(
			"CS17 Coding Exam Change",
			filters={"exam": exam},
			fields=[
				"student",
				"student.full_name as student_name",
				"change",
				"changed_by",
				"changed_by.full_name as changed_by_name",
				"changed_on",
			],
			order_by="changed_on desc",
		),
	}


@frappe.whitelist(methods=["POST"])
def save_coding_exam(
	title: str,
	cohort: str,
	duration_minutes: int,
	opens_on: str,
	last_start_on: str,
	closes_on: str,
	question_order: str,
	questions: list | str,
	exam: str | None = None,
	quarter: str | None = None,
	instructions: str = "",
	can_go_back: int = 0,
	is_published: int = 0,
	require_fullscreen: int | None = None,
	count_window_switches: int | None = None,
	paste_rule: str | None = None,
	watch_copy: int | None = None,
	leave_limit: int | None = None,
	leave_seconds: int | None = None,
	leave_action: str | None = None,
	alert_kinds: str | None = None,
	require_seb: int | None = None,
	seb_browser_exam_key: str | None = None,
) -> str:
	faculty = get_current_faculty()
	if faculty.cohort and faculty.cohort != cohort:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	exam_doc = require_faculty_exam(exam) if exam else frappe.new_doc(CODING_EXAM)
	exam_doc.update(
		{
			"title": title,
			"cohort": cohort,
			"quarter": quarter or None,
			"instructions": instructions,
			"duration_minutes": duration_minutes,
			"opens_on": opens_on,
			"last_start_on": last_start_on,
			"closes_on": closes_on,
			"question_order": question_order,
			"can_go_back": can_go_back,
			"is_published": is_published,
		}
	)
	rules = {
		"require_fullscreen": require_fullscreen,
		"count_window_switches": count_window_switches,
		"paste_rule": paste_rule,
		"watch_copy": watch_copy,
		"leave_limit": leave_limit,
		"leave_seconds": leave_seconds,
		"leave_action": leave_action,
		"alert_kinds": alert_kinds,
		"require_seb": require_seb,
		"seb_browser_exam_key": seb_browser_exam_key,
	}
	exam_doc.update({field: value for field, value in rules.items() if value is not None})
	exam_doc.set(
		"questions",
		[
			{"assignment": row.get("assignment"), "marks": row.get("marks")}
			for row in frappe.parse_json(questions)
		],
	)
	exam_doc.save(ignore_permissions=True)
	return exam_doc.name


@frappe.whitelist(methods=["GET"])
def get_exam_question_choices(cohort: str, exam: str | None = None) -> list:
	faculty = get_current_faculty()
	if faculty.cohort and faculty.cohort != cohort:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	assignments = frappe.get_all(
		"CS17 Assignment",
		filters={
			"cohort": cohort,
			"submission_type": "Python",
			"is_published": 0,
			"publish_on": ["is", "not set"],
		},
		or_filters=[["coding_exam", "is", "not set"], ["coding_exam", "=", exam or ""]],
		fields=["name", "title", "max_marks", "coding_exam"],
		order_by="creation desc",
	)
	submitted = set(
		frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={
				"assignment": [
					"in",
					[assignment.name for assignment in assignments if not assignment.coding_exam],
				]
			},
			pluck="assignment",
		)
	)
	test_counts = Counter(
		frappe.get_all(
			"CS17 Python Test Case",
			filters={
				"parent": ["in", [assignment.name for assignment in assignments]],
				"parenttype": "CS17 Assignment",
				"parentfield": "test_cases",
			},
			pluck="parent",
		)
	)
	choices = []
	for assignment in assignments:
		if test_counts[assignment.name] and assignment.name not in submitted:
			assignment.test_count = test_counts[assignment.name]
			choices.append(assignment)
	return choices


@frappe.whitelist(methods=["GET"])
def get_coding_exam_students(exam: str) -> list:
	exam_doc = require_faculty_exam(exam)
	students = get_cohort_students(exam_doc.cohort)
	assignments = [row.assignment for row in exam_doc.questions]
	attempts = {
		attempt.student: attempt
		for attempt in frappe.get_all(
			ATTEMPT,
			filters={"exam": exam},
			fields=["name", "student", "started_at", "ends_at", "extra_minutes", "paused_at", "finished_on"],
		)
	}
	progress = {
		(row.parent, row.assignment): row
		for row in frappe.get_all(
			"CS17 Coding Exam Attempt Question",
			filters={
				"parent": ["in", [attempt.name for attempt in attempts.values()]],
				"parenttype": ATTEMPT,
			},
			fields=["parent", "assignment", "skipped_on", "reopened_on"],
		)
	}
	submissions = {
		(submission.student, submission.assignment): submission
		for submission in frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={"assignment": ["in", assignments], "student": ["in", list(attempts)]},
			fields=["name", "student", "assignment", "submitted_at"],
		)
	}
	with_project = {
		(project.profile, project.assignment)
		for project in frappe.get_all(
			"CS17 Project",
			filters={
				"profile": ["in", list(attempts)],
				"assignment": ["in", assignments],
				"project_type": "Python",
			},
			fields=["profile", "assignment"],
		)
	}
	published_marks = {
		grade.submission: grade.marks_obtained
		for grade in frappe.get_all(
			"CS17 Assignment Grade",
			filters={"submission": ["in", [submission.name for submission in submissions.values()]]},
			fields=["submission", "marks_obtained", "is_published", "published_on"],
		)
		if is_published_now(grade, "published_on")
	}
	max_marks = dict(
		frappe.get_all(
			"CS17 Assignment",
			filters={"name": ["in", assignments]},
			fields=["name", "max_marks"],
			as_list=True,
		)
	)

	rows = []
	for student in students:
		attempt = attempts.get(student.student) or frappe._dict()
		row = frappe._dict(
			student=student.student,
			full_name=student.full_name,
			state="not_started",
			started_at=None,
			ends_at=None,
			is_paused=False,
			extra_minutes=0,
			questions=[],
			total_marks=None,
			max_marks=sum(flt(question.marks) for question in exam_doc.questions),
		)
		if attempt:
			row.update(
				state="finished" if attempt.finished_on else "in_progress",
				started_at=attempt.started_at,
				ends_at=current_ends_at(attempt, exam_doc.closes_on),
				is_paused=bool(attempt.paused_at),
				extra_minutes=cint(attempt.extra_minutes),
			)
		scores = []
		for question in exam_doc.questions:
			submission = submissions.get((student.student, question.assignment))
			step = progress.get((attempt.name, question.assignment)) or frappe._dict()
			is_submitted = (
				submission and submission.submitted_at and submission.submitted_at >= attempt.started_at
			)
			row.questions.append(
				{
					"assignment": question.assignment,
					"state": question_state(
						submission.submitted_at if is_submitted else None,
						step.skipped_on,
						step.reopened_on,
						(student.student, question.assignment) in with_project,
					),
				}
			)
			if submission and submission.name in published_marks and flt(max_marks[question.assignment]) > 0:
				scores.append(
					flt(published_marks[submission.name])
					/ flt(max_marks[question.assignment])
					* flt(question.marks)
				)
		if scores:
			row.total_marks = flt(sum(scores), 2)
		rows.append(row)
	return rows


@frappe.whitelist(methods=["POST"])
def add_exam_time(exam: str, minutes: int, student: str | None = None) -> None:
	require_faculty_exam(exam)
	minutes = cint(minutes)
	if minutes < 1:
		frappe.throw(_("Add at least 1 minute."))
	attempts = unfinished_attempts(exam, student)
	if not attempts:
		frappe.throw(_("Nobody is taking this exam right now."))
	for attempt in attempts:
		attempt.add_time(minutes)
	unit = _("minute") if minutes == 1 else _("minutes")
	log_change(exam, _("Added {0} {1} for {2}").format(minutes, unit, name_or_everyone(student)), student)


@frappe.whitelist(methods=["POST"])
def pause_coding_exam(exam: str, student: str | None = None) -> None:
	require_faculty_exam(exam)
	now = now_datetime()
	attempts = [
		attempt
		for attempt in unfinished_attempts(exam, student)
		if not attempt.paused_at and now <= attempt.ends_at
	]
	if not attempts:
		frappe.throw(_("There is no running clock to pause."))
	for attempt in attempts:
		attempt.pause()
	log_change(exam, _("Paused the clock for {0}").format(name_or_everyone(student)), student)


@frappe.whitelist(methods=["POST"])
def resume_coding_exam(exam: str, student: str | None = None) -> None:
	require_faculty_exam(exam)
	attempts = [attempt for attempt in unfinished_attempts(exam, student) if attempt.paused_at]
	if not attempts:
		frappe.throw(_("There is no paused clock to resume."))
	for attempt in attempts:
		attempt.resume()
	log_change(exam, _("Resumed the clock for {0}").format(name_or_everyone(student)), student)


@frappe.whitelist(methods=["POST"])
def set_exam_closes_on(exam: str, closes_on: str) -> None:
	exam_doc = require_faculty_exam(exam)
	exam_doc.closes_on = closes_on
	exam_doc.save(ignore_permissions=True)
	log_change(exam, _("Moved the close time to {0}").format(format_datetime(exam_doc.closes_on)))


@frappe.whitelist(methods=["POST"])
def set_exam_banner(exam: str, banner: str = "") -> None:
	exam_doc = require_faculty_exam(exam)
	exam_doc.banner = banner.strip() or None
	exam_doc.save(ignore_permissions=True)
	log_change(
		exam, _("Set the banner: {0}").format(exam_doc.banner) if exam_doc.banner else _("Removed the banner")
	)


@frappe.whitelist(methods=["POST"])
def reopen_exam_question(exam: str, student: str, assignment: str) -> None:
	exam_doc = require_faculty_exam(exam)
	attempts = unfinished_attempts(exam, student)
	if not attempts:
		frappe.throw(_("{0} is not taking this exam right now.").format(name_or_everyone(student)))
	question = get_exam_question(exam_doc, attempts[0], assignment)
	if question.state not in PASSED:
		frappe.throw(_("Only a submitted or skipped question can be reopened."))
	progress_row(attempts[0], assignment).reopened_on = now_datetime()
	attempts[0].save(ignore_permissions=True)
	log_change(exam, _("Reopened {0} for {1}").format(question.title, name_or_everyone(student)), student)


def get_student_exam(exam: str, student: str) -> "Document":
	exam_doc = frappe.get_doc(CODING_EXAM, exam)
	if not exam_doc.is_published or exam_doc.cohort != frappe.db.get_value("CS17 Profile", student, "cohort"):
		frappe.throw(_("Exam not found"), frappe.DoesNotExistError)
	return exam_doc


def require_faculty_exam(exam: str) -> "Document":
	faculty = get_current_faculty()
	exam_doc = frappe.get_doc(CODING_EXAM, exam)
	if faculty.cohort and faculty.cohort != exam_doc.cohort:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return exam_doc


def get_attempt_doc(exam: str, student: str) -> "Document | None":
	name = frappe.db.get_value(ATTEMPT, {"exam": exam, "student": student})
	return frappe.get_doc(ATTEMPT, name) if name else None


def unfinished_attempts(exam: str, student: str | None = None) -> list:
	filters = {"exam": exam, "finished_on": ["is", "not set"]}
	if student:
		filters["student"] = student
	return [frappe.get_doc(ATTEMPT, name) for name in frappe.get_all(ATTEMPT, filters=filters, pluck="name")]


def attempt_details(attempt: "Document", closes_on: str) -> dict:
	return {
		"started_at": attempt.started_at,
		"ends_at": current_ends_at(attempt, closes_on),
		"is_paused": bool(attempt.paused_at),
		"finished_on": attempt.finished_on,
	}


def current_ends_at(attempt: frappe._dict, closes_on: str) -> "datetime":
	if not attempt.paused_at:
		return get_datetime(attempt.ends_at)
	paused_for = time_diff_in_seconds(now_datetime(), attempt.paused_at)
	return min(add_to_date(get_datetime(attempt.ends_at), seconds=paused_for), get_datetime(closes_on))


def get_question_attempt(exam: str, student: str) -> frappe._dict | None:
	attempt = frappe.db.get_value(
		ATTEMPT,
		{"exam": exam, "student": student},
		["started_at", "ends_at", "paused_at", "finished_on", "exam.closes_on as closes_on"],
		as_dict=True,
	)
	if not attempt:
		return None
	return frappe._dict(
		started_at=attempt.started_at,
		ends_at=attempt.finished_on or current_ends_at(attempt, attempt.closes_on),
	)


def get_questions(exam_doc: "Document", attempt: "Document") -> list:
	assignments = [row.assignment for row in exam_doc.questions]
	titles = dict(
		frappe.get_all(
			"CS17 Assignment", filters={"name": ["in", assignments]}, fields=["name", "title"], as_list=True
		)
	)
	projects = get_projects(attempt.student, assignments)
	submitted_at = dict(
		frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={
				"student": attempt.student,
				"assignment": ["in", assignments],
				"submitted_at": [">=", attempt.started_at],
			},
			fields=["assignment", "submitted_at"],
			as_list=True,
		)
	)
	steps = {row.assignment: row for row in attempt.questions}
	questions = []
	for row in exam_doc.questions:
		step = steps.get(row.assignment) or frappe._dict()
		questions.append(
			frappe._dict(
				assignment=row.assignment,
				title=titles.get(row.assignment),
				marks=row.marks,
				project=projects.get(row.assignment),
				state=question_state(
					submitted_at.get(row.assignment),
					step.skipped_on,
					step.reopened_on,
					row.assignment in projects,
				),
				is_locked_by_rule=is_locked_by_rule(step),
			)
		)
	current = next(
		(index for index, question in enumerate(questions) if question.state not in PASSED), len(questions)
	)
	for index, question in enumerate(questions):
		question.is_locked = question.is_locked_by_rule or (
			exam_doc.question_order == "One by one"
			and (index > current or (question.state in PASSED and not exam_doc.can_go_back))
		)
	return questions


def get_exam_question(exam_doc: "Document", attempt: "Document", assignment: str) -> frappe._dict:
	question = next(
		(question for question in get_questions(exam_doc, attempt) if question.assignment == assignment), None
	)
	if not question:
		frappe.throw(_("Question not found"), frappe.DoesNotExistError)
	return question


def question_state(submitted_at, skipped_on, reopened_on, has_project: bool) -> str:
	if submitted_at and not (reopened_on and get_datetime(submitted_at) <= get_datetime(reopened_on)):
		return "submitted"
	if skipped_on and not (reopened_on and get_datetime(skipped_on) <= get_datetime(reopened_on)):
		return "skipped"
	return "in_progress" if has_project else "not_started"


def get_projects(student: str, assignments: list) -> dict:
	return {
		project.assignment: project.name
		for project in frappe.get_all(
			"CS17 Project",
			filters={"profile": student, "assignment": ["in", assignments], "project_type": "Python"},
			fields=["name", "assignment"],
			order_by="creation asc",
		)
	}


def progress_row(attempt: "Document", assignment: str) -> "Document":
	return next((row for row in attempt.questions if row.assignment == assignment), None) or attempt.append(
		"questions", {"assignment": assignment}
	)


def attempt_closed_reason(attempt: "Document | None", grace_seconds: int = 0) -> str | None:
	if not attempt:
		return _("Start the exam first.")
	if attempt.finished_on:
		return _("You have finished this exam.")
	if attempt.paused_at:
		return _("Your exam is paused. Wait for your teacher to resume it.")
	if now_datetime() > add_to_date(get_datetime(attempt.ends_at), seconds=grace_seconds):
		return _("Your time for this exam is up.")
	return None


def question_closed_reason(exam: str, assignment: str, student: str, grace_seconds: int = 0) -> str | None:
	attempt = get_attempt_doc(exam, student)
	if reason := attempt_closed_reason(attempt, grace_seconds):
		return reason
	if is_question_locked(frappe.get_doc(CODING_EXAM, exam), attempt, assignment):
		return _("This question is locked.")
	return None


def require_open_question(exam: str, assignment: str, student: str, is_saving: bool = False) -> None:
	require_safe_exam_browser(exam)
	if reason := question_closed_reason(
		exam, assignment, student, AUTO_SUBMIT_GRACE_SECONDS if is_saving else 0
	):
		frappe.throw(reason)


def can_read_question(exam: str, assignment: str, student: str) -> bool:
	require_safe_exam_browser(exam)
	attempt = get_attempt_doc(exam, student)
	if not attempt:
		return False
	return bool(attempt.finished_on) or not is_question_locked(
		frappe.get_doc(CODING_EXAM, exam), attempt, assignment
	)


def is_question_locked(exam_doc: "Document", attempt: "Document", assignment: str) -> bool:
	step = next((row for row in attempt.questions if row.assignment == assignment), frappe._dict())
	return is_locked_by_rule(step) or (
		exam_doc.question_order == "One by one" and get_exam_question(exam_doc, attempt, assignment).is_locked
	)


def is_locked_by_rule(step: frappe._dict) -> bool:
	return bool(step.locked_on) and not (
		step.reopened_on and get_datetime(step.locked_on) <= get_datetime(step.reopened_on)
	)


def name_or_everyone(student: str | None) -> str:
	return frappe.db.get_value("CS17 Profile", student, "full_name") if student else _("everyone")


def log_change(exam: str, change: str, student: str | None = None) -> None:
	frappe.get_doc(
		{
			"doctype": "CS17 Coding Exam Change",
			"exam": exam,
			"student": student,
			"change": change,
			"changed_by": frappe.session.user,
			"changed_on": now_datetime(),
		}
	).insert(ignore_permissions=True)
