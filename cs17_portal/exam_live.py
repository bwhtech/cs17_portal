import frappe
from frappe import _
from frappe.query_builder import Case
from frappe.query_builder.functions import Coalesce, Max
from frappe.utils import add_to_date, now_datetime

from cs17_portal.api import ASSIGNMENT_SUBMISSION
from cs17_portal.coding_exam import get_coding_exam_students, require_faculty_exam
from cs17_portal.live_lab import STUCK_FAILING_MINUTES, STUCK_IDLE_MINUTES

EXAM_EVENT = "CS17 Exam Event"
EVENT_LIMIT = 100
# A row is stamped before its request commits, so a poll can miss one stamped just before it.
EVENT_OVERLAP_SECONDS = 60
STATE_ORDER = {"in_progress": 0, "finished": 1, "not_started": 2}


@frappe.whitelist(methods=["GET"])
def get_exam_live(exam: str, since: str | None = None) -> dict:
	exam_doc = require_faculty_exam(exam)
	now = now_datetime()
	assignments = [row.assignment for row in exam_doc.questions]
	titles = dict(
		frappe.get_all(
			"CS17 Assignment", filters={"name": ["in", assignments]}, fields=["name", "title"], as_list=True
		)
	)
	saved_at = {
		(project.profile, project.assignment): project.last_saved_at
		for project in frappe.get_all(
			"CS17 Project",
			filters={"assignment": ["in", assignments], "project_type": "Python"},
			fields=["profile", "assignment", "last_saved_at"],
			order_by="creation asc",
		)
	}
	submitted_at = {
		(row.student, row.assignment): row.submitted_at
		for row in frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={"assignment": ["in", assignments]},
			fields=["student", "assignment", "submitted_at"],
		)
	}
	run = frappe.qb.DocType("CS17 Code Run")
	failing = (Coalesce(run.error_type, "") != "") | (run.passed < run.total)
	failing_since = add_to_date(now, minutes=-STUCK_FAILING_MINUTES)
	summaries = {
		(row.student, row.assignment): row
		for row in frappe.qb.from_(run)
		.select(
			run.student,
			run.assignment,
			Max(run.ran_at).as_("ran_at"),
			Max(Case().when(run.total > 0, run.ran_at)).as_("tested_at"),
			Max(Case().when(~failing, run.ran_at)).as_("passing_at"),
			Max(Case().when(failing & (run.ran_at <= failing_since), run.ran_at)).as_("failing_at"),
		)
		.where(run.assignment.isin(assignments or [""]))
		.groupby(run.student, run.assignment)
		.run(as_dict=True)
	}
	tested = {
		(row.student, row.assignment, row.ran_at): row
		for row in frappe.get_all(
			"CS17 Code Run",
			filters={
				"assignment": ["in", assignments],
				"ran_at": ["in", [row.tested_at for row in summaries.values() if row.tested_at] or [""]],
			},
			fields=["student", "assignment", "ran_at", "passed", "total"],
		)
	}
	event_filters = {"exam": exam}
	if alert_kinds := (exam_doc.alert_kinds or "").split():
		event_filters["kind"] = ["in", alert_kinds]
	alerts = dict(
		frappe.get_all(
			EXAM_EVENT,
			filters=event_filters,
			fields=["student", {"COUNT": "name", "as": "count"}],
			group_by="student",
			as_list=True,
		)
	)

	idle_since = add_to_date(now, minutes=-STUCK_IDLE_MINUTES)
	students = get_coding_exam_students(exam)
	for row in students:
		active_at = {}
		failing_questions = set()
		for question in row.questions:
			key = (row.student, question["assignment"])
			summary = summaries.get(key, frappe._dict())
			result = tested.get((*key, summary.tested_at), frappe._dict())
			question.update(passed=result.passed, total=result.total)
			if times := [at for at in (saved_at.get(key), summary.ran_at, submitted_at.get(key)) if at]:
				active_at[question["assignment"]] = max(times)
			if (
				question["state"] != "submitted"
				and summary.failing_at
				and (not summary.passing_at or summary.failing_at > summary.passing_at)
			):
				failing_questions.add(question["assignment"])
		row.current_question = max(active_at, key=active_at.get, default=None)
		row.last_active_at = max((at for at in (row.started_at, *active_at.values()) if at), default=None)
		row.alerts = alerts.get(row.student, 0)
		row.stuck = (
			row.state == "in_progress"
			and not row.is_paused
			and (row.current_question in failing_questions or row.last_active_at <= idle_since)
		)

	if since:
		event_filters["modified"] = [">", add_to_date(since, seconds=-EVENT_OVERLAP_SECONDS)]
	return {
		"title": exam_doc.title,
		"now": now,
		"questions": [{"assignment": name, "title": titles.get(name)} for name in assignments],
		"students": sorted(
			students,
			key=lambda row: (not row.stuck, not row.alerts, STATE_ORDER[row.state], row.full_name or ""),
		),
		"events": frappe.get_all(
			EXAM_EVENT,
			filters=event_filters,
			fields=[
				"name",
				"student",
				"student.full_name as student_name",
				"assignment",
				"kind",
				"occurred_at",
				"seconds",
				"detail",
				"modified",
			],
			order_by="occurred_at desc",
			limit=EVENT_LIMIT,
		),
	}


@frappe.whitelist(methods=["GET"])
def get_exam_question_code(exam: str, student: str, assignment: str) -> dict:
	exam_doc = require_faculty_exam(exam)
	if assignment not in {row.assignment for row in exam_doc.questions}:
		frappe.throw(_("Question not found"), frappe.DoesNotExistError)
	project = frappe.db.get_value(
		"CS17 Project",
		{"profile": student, "assignment": assignment, "project_type": "Python"},
		["code", "last_saved_at"],
		as_dict=True,
		order_by="creation desc",
	)
	if not project:
		frappe.throw(_("Nothing is saved for this question yet."), frappe.DoesNotExistError)
	return project
