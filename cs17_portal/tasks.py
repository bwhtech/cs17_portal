from typing import TYPE_CHECKING

import frappe
from frappe import _
from frappe.query_builder.functions import Count
from frappe.utils import add_to_date, format_datetime, get_url, getdate, now_datetime
from frappe.utils.background_jobs import defer_enqueue_after_commit

from cs17_portal.api import ASSIGNMENT_SUBMISSION, submit_python_code, time_limit_ends_at
from cs17_portal.guardian import get_child_assignments, get_children, is_due_this_week, is_missing

if TYPE_CHECKING:
	from datetime import datetime


def auto_publish_assignments():
	_publish_due("CS17 Assignment", "publish_on", "Scheduled assignment not published")


def auto_publish_grades():
	_publish_due("CS17 Assignment Grade", "published_on", "Scheduled grade not published")


def auto_publish_results():
	results = frappe.get_all(
		"CS17 Result",
		filters=[
			["is_published", "=", 0],
			["published_on", "is", "set"],
			["published_on", "<=", now_datetime()],
		],
		fields=["name", "modified"],
		as_list=True,
	)
	for name, modified in results:
		try:
			frappe.get_lazy_doc("CS17 Result", name).publish()
		except Exception:
			title = "Scheduled result not published"
			if not frappe.get_all(
				"Error Log",
				filters={
					"method": title,
					"reference_doctype": "CS17 Result",
					"reference_name": name,
					"creation": (">", modified),
				},
				limit=1,
			):
				frappe.log_error(title=title, reference_doctype="CS17 Result", reference_name=name)


def auto_publish_announcements():
	announcements = frappe.get_all(
		"CS17 Announcement",
		filters=[["is_published", "=", 0], ["publish_on", "is", "set"], ["publish_on", "<=", now_datetime()]],
		fields=["name", "modified"],
		as_list=True,
	)
	for name, modified in announcements:
		frappe.db.savepoint("publish_announcement")
		try:
			doc = frappe.get_doc("CS17 Announcement", name)
			doc.is_published = 1
			doc.published_date = getdate(doc.publish_on)
			doc.publish_on = None
			with defer_enqueue_after_commit():
				doc.save(ignore_permissions=True)
		except Exception:
			frappe.db.rollback(save_point="publish_announcement")
			title = "Scheduled announcement not published"
			if not frappe.get_all(
				"Error Log",
				filters={
					"method": title,
					"reference_doctype": "CS17 Announcement",
					"reference_name": name,
					"creation": (">", modified),
				},
				limit=1,
			):
				frappe.log_error(title=title, reference_doctype="CS17 Announcement", reference_name=name)


def remind_due_assignments():
	hour = now_datetime().replace(minute=0, second=0, microsecond=0)
	assignments = frappe.get_all(
		"CS17 Assignment",
		filters=[
			["is_published", "=", 1],
			["due_date", ">", add_to_date(hour, hours=23)],
			["due_date", "<=", add_to_date(hour, hours=24)],
			["coding_exam", "is", "not set"],
		],
		pluck="name",
	)
	for name in assignments:
		frappe.get_doc("CS17 Assignment", name).remind_students()


def _publish_due(doctype: str, publish_on_field: str, error_title: str) -> None:
	"""Publish records whose scheduled publish time has passed."""
	due = frappe.get_all(
		doctype,
		filters=[
			["is_published", "=", 0],
			[publish_on_field, "is", "set"],
			[publish_on_field, "<=", now_datetime()],
		],
		fields=["name", "modified"],
		as_list=True,
	)
	for name, modified in due:
		frappe.db.savepoint("publish_due")
		try:
			doc = frappe.get_doc(doctype, name)
			doc.is_published = 1
			with defer_enqueue_after_commit():
				doc.save(ignore_permissions=True)
		except Exception:
			frappe.db.rollback(save_point="publish_due")
			if not frappe.get_all(
				"Error Log",
				filters={
					"method": error_title,
					"reference_doctype": doctype,
					"reference_name": name,
					"creation": (">", modified),
				},
				limit=1,
			):
				frappe.log_error(title=error_title, reference_doctype=doctype, reference_name=name)


def send_faculty_digest():
	faculty = frappe.get_all(
		"CS17 Profile",
		filters=[["profile_type", "=", "Faculty"], ["user.enabled", "=", 1], ["user.email", "is", "set"]],
		fields=["user", "user.email as email", "cohort"],
	)
	opted_out = frappe.get_all(
		"Notification Settings",
		filters={"name": ["in", [member.user for member in faculty]], "enable_email_notifications": 0},
		pluck="name",
	)
	faculty = [member for member in faculty if member.user not in opted_out]
	if not faculty:
		return

	now = now_datetime()
	submission = frappe.qb.DocType("CS17 Assignment Submission")
	assignment = frappe.qb.DocType("CS17 Assignment")
	grade = frappe.qb.DocType("CS17 Assignment Grade")
	waiting_by_cohort = dict(
		frappe.qb.from_(submission)
		.join(assignment)
		.on(assignment.name == submission.assignment)
		.left_join(grade)
		.on((grade.submission == submission.name) & ((grade.is_published == 1) | (grade.published_on <= now)))
		.select(assignment.cohort, Count(submission.name))
		.where((submission.docstatus < 2) & submission.returned_on.isnull() & grade.name.isnull())
		.groupby(assignment.cohort)
		.run()
	)

	assignments = frappe.get_all(
		"CS17 Assignment",
		filters=[
			["is_published", "=", 1],
			["due_date", ">", add_to_date(now, days=-7)],
			["due_date", "<=", add_to_date(now, days=7)],
		],
		fields=["name", "title", "cohort", "due_date"],
		order_by="due_date asc",
	)
	for row in assignments:
		row.link = get_url(f"/dashboard/faculty/assignments/{row.name}")
		row.due = format_datetime(row.due_date, "MMM d, h:mm a")

	fell_due = [row for row in assignments if row.due_date <= now]
	if fell_due:
		names = [row.name for row in fell_due]
		students_by_assignment = {}
		for row in frappe.get_all(
			"CS17 Assignment Student",
			filters={"parent": ("in", names), "parenttype": "CS17 Assignment"},
			fields=["parent", "student"],
		):
			students_by_assignment.setdefault(row.parent, set()).add(row.student)
		students_by_cohort = {}
		for row in frappe.get_all(
			"CS17 Profile",
			filters=[
				["profile_type", "=", "Student"],
				["cohort", "in", list({row.cohort for row in fell_due})],
				["user", "not in", frappe.get_all("User", filters={"enabled": 0}, pluck="name")],
			],
			fields=["name", "cohort"],
		):
			students_by_cohort.setdefault(row.cohort, set()).add(row.name)
		submitted = {}
		for row in frappe.get_all(
			"CS17 Assignment Submission",
			filters={"assignment": ("in", names), "docstatus": ("<", 2)},
			fields=["assignment", "student"],
		):
			submitted.setdefault(row.assignment, set()).add(row.student)
		for row in fell_due:
			in_cohort = students_by_cohort.get(row.cohort, set())
			given = in_cohort & students_by_assignment.get(row.name, in_cohort)
			row.given = len(given)
			row.not_submitted = len(given - submitted.get(row.name, set()))

	submissions_link = get_url("/dashboard/faculty/submissions")
	for member in faculty:
		in_scope = [row for row in assignments if not member.cohort or row.cohort == member.cohort]
		waiting = (
			waiting_by_cohort.get(member.cohort, 0) if member.cohort else sum(waiting_by_cohort.values())
		)
		due_soon = [row for row in in_scope if row.due_date > now]
		not_submitted = [row for row in in_scope if row.not_submitted]
		if waiting or due_soon or not_submitted:
			frappe.sendmail(
				recipients=[member.email],
				subject=_("Your weekly summary"),
				template="faculty_digest",
				args={
					"waiting": waiting,
					"submissions_link": submissions_link,
					"due_soon": due_soon,
					"not_submitted": not_submitted,
				},
			)


def send_guardian_digest():
	guardians = frappe.get_all(
		"CS17 Profile",
		filters=[["profile_type", "=", "Guardian"], ["user.enabled", "=", 1], ["user.email", "is", "set"]],
		fields=["name", "user", "user.email as email"],
	)
	opted_out = frappe.get_all(
		"Notification Settings",
		filters={"name": ["in", [guardian.user for guardian in guardians]], "enable_email_notifications": 0},
		pluck="name",
	)
	guardians = [guardian for guardian in guardians if guardian.user not in opted_out]
	if not guardians:
		return

	now = now_datetime()
	week_ago = add_to_date(now, days=-7)
	weeks = {}
	weeks_by_guardian = {}
	for child in get_children([guardian.name for guardian in guardians]):
		if child.student not in weeks:
			assignments = get_child_assignments(child)
			for assignment in assignments:
				assignment.due = assignment.due_date and format_datetime(assignment.due_date, "MMM d, h:mm a")
			weeks[child.student] = frappe._dict(
				full_name=child.full_name,
				link=get_url(f"/dashboard/guardian/students/{child.student}"),
				due=[assignment for assignment in assignments if is_due_this_week(assignment, now)],
				missing=[assignment for assignment in assignments if is_missing(assignment, now)],
				graded=[
					assignment
					for assignment in assignments
					if assignment.grade and assignment.grade.published_at > week_ago
				],
			)
		weeks_by_guardian.setdefault(child.guardian, []).append(weeks[child.student])

	for guardian in guardians:
		children = [
			week
			for week in weeks_by_guardian.get(guardian.name, [])
			if week.due or week.missing or week.graded
		]
		if children:
			frappe.sendmail(
				recipients=[guardian.email],
				subject=_("This week at CS17"),
				template="guardian_digest",
				args={"children": children},
			)


def submit_saved_work_when_time_is_up():
	now = now_datetime()
	for name, modified in frappe.get_all(
		"CS17 Coding Exam Attempt",
		filters=[["finished_on", "is", "not set"], ["paused_at", "is", "not set"], ["ends_at", "<", now]],
		fields=["name", "modified"],
		as_list=True,
	):
		frappe.db.savepoint("finish_exam_attempt")
		try:
			frappe.get_doc("CS17 Coding Exam Attempt", name).finish()
		except Exception:
			frappe.db.rollback(save_point="finish_exam_attempt")
			_log_error_once(
				"Exam work not submitted when time was up", "CS17 Coding Exam Attempt", name, modified
			)

	latest_attempts = {}
	for attempt in frappe.get_all(
		"CS17 Assignment Attempt",
		filters=[
			["assignment.submit_saved_work", "=", 1],
			["assignment.time_limit", ">", 0],
			["started_at", ">", add_to_date(now, days=-1)],
		],
		fields=[
			"name",
			"modified",
			"assignment",
			"student",
			"started_at",
			"assignment.time_limit as time_limit",
			"assignment.due_date as due_date",
			"assignment.late_until as late_until",
		],
		order_by="started_at desc",
	):
		latest_attempts.setdefault((attempt.assignment, attempt.student), attempt)
	timed_out = [
		attempt
		for attempt in latest_attempts.values()
		if time_limit_ends_at(attempt.started_at, attempt.time_limit, attempt.late_until or attempt.due_date)
		< now
	]
	if not timed_out:
		return

	assignments = [attempt.assignment for attempt in timed_out]
	students = [attempt.student for attempt in timed_out]
	submitted_at = {
		(submission.assignment, submission.student): submission.submitted_at
		for submission in frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={"assignment": ["in", assignments], "student": ["in", students]},
			fields=["assignment", "student", "submitted_at"],
		)
	}
	projects = {
		(project.assignment, project.profile): project
		for project in frappe.get_all(
			"CS17 Project",
			filters={
				"assignment": ["in", assignments],
				"profile": ["in", students],
				"project_type": "Python",
			},
			fields=["name", "assignment", "profile", "last_saved_at"],
			order_by="creation asc",
		)
	}
	for attempt in timed_out:
		project = projects.get((attempt.assignment, attempt.student))
		submitted = submitted_at.get((attempt.assignment, attempt.student))
		if not (project and project.last_saved_at and project.last_saved_at >= attempt.started_at):
			continue
		if submitted and submitted >= attempt.started_at:
			continue
		frappe.db.savepoint("submit_saved_work")
		try:
			project_doc = frappe.get_doc("CS17 Project", project.name)
			if (project_doc.code or "").strip():
				submit_python_code(attempt.assignment, attempt.student, project_doc, ignore_deadline=True)
		except Exception:
			frappe.db.rollback(save_point="submit_saved_work")
			_log_error_once(
				"Saved work not submitted when time was up",
				"CS17 Assignment Attempt",
				attempt.name,
				attempt.modified,
			)


def _log_error_once(title: str, doctype: str, name: str, modified: "datetime") -> None:
	if not frappe.get_all(
		"Error Log",
		filters={
			"method": title,
			"reference_doctype": doctype,
			"reference_name": name,
			"creation": (">", modified),
		},
		limit=1,
	):
		frappe.log_error(title=title, reference_doctype=doctype, reference_name=name)
