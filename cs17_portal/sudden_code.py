import frappe
from frappe import _
from frappe.query_builder.functions import Coalesce
from frappe.utils import add_to_date, get_datetime
from pypika.functions import Length, Replace

from cs17_portal.api import ASSIGNMENT_SUBMISSION, require_faculty_for_assignment

SUDDEN_CODE_MIN_LINES = 6
SUDDEN_CODE_SHARE = 0.7
LARGE_PASTE_LINES = 5
LEAD_UP_MINUTES = 2


@frappe.whitelist(methods=["GET"])
def get_sudden_code(assignment: str) -> dict:
	require_faculty_for_assignment(assignment)
	return find_sudden_code(assignment, {"assignment": assignment})


@frappe.whitelist(methods=["GET"])
def get_submission_sudden_code(submission: str) -> dict | None:
	assignment = frappe.db.get_value(ASSIGNMENT_SUBMISSION, submission, "assignment")
	if not assignment:
		frappe.throw(_("Submission not found"), frappe.DoesNotExistError)
	require_faculty_for_assignment(assignment)
	return find_sudden_code(assignment, {"name": submission}).get(submission)


def find_sudden_code(assignment: str, filters: dict) -> dict:
	submissions = frappe.get_all(
		ASSIGNMENT_SUBMISSION,
		filters={**filters, "project": ("is", "set")},
		fields=["name", "student", "project", "code"],
	)
	if not submissions:
		return {}

	starter_lines = _count_lines(frappe.db.get_value("CS17 Assignment", assignment, "starter_code"))
	students = [submission.student for submission in submissions]
	snapshot = frappe.qb.DocType("CS17 Code Snapshot")
	code = Coalesce(snapshot.code, "")
	lines_by_project = {}
	for row in (
		frappe.qb.from_(snapshot)
		.select(
			snapshot.project,
			snapshot.saved_at,
			(Length(code) - Length(Replace(code, "\n", "")) + 1).as_("lines"),
		)
		.where(snapshot.project.isin([submission.project for submission in submissions]))
		.orderby(snapshot.saved_at)
		.run(as_dict=True)
	):
		lines_by_project.setdefault(row.project, []).append(row)
	pastes = frappe.get_all(
		"CS17 Paste",
		filters={
			"assignment": assignment,
			"student": ("in", students),
			"line_count": (">=", LARGE_PASTE_LINES),
		},
		fields=["student", "pasted_at"],
	)
	tab_leaves = frappe.get_all(
		"CS17 Tab Leave",
		filters={"assignment": assignment, "student": ("in", students)},
		fields=["student", "left_at", "returned_at"],
	)

	flagged = {}
	for submission in submissions:
		final_lines = _count_lines(submission.code)
		if final_lines < SUDDEN_CODE_MIN_LINES:
			continue
		previous_lines = starter_lines
		for snapshot in lines_by_project.get(submission.project, []):
			lines = snapshot.lines
			if lines - previous_lines >= SUDDEN_CODE_SHARE * final_lines:
				lead_up = (add_to_date(snapshot.saved_at, minutes=-LEAD_UP_MINUTES), snapshot.saved_at)
				flagged[submission.name] = {
					"saved_at": snapshot.saved_at,
					"after_paste": any(
						paste.student == submission.student and _is_within(paste.pasted_at, lead_up)
						for paste in pastes
					),
					"after_tab_leave": any(
						leave.student == submission.student
						and _is_within(leave.returned_at or leave.left_at, lead_up)
						for leave in tab_leaves
					),
				}
				break
			previous_lines = lines
	return flagged


def _is_within(moment, period: tuple) -> bool:
	start, end = period
	return bool(moment) and start <= get_datetime(moment) <= end


def _count_lines(code: str | None) -> int:
	return code.count("\n") + 1 if code else 0
