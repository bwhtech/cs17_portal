import frappe
from frappe.query_builder.functions import Max, Min
from frappe.utils import time_diff_in_seconds

from cs17_portal.api import ASSIGNMENT_SUBMISSION
from cs17_portal.guardian import require_faculty_for_student


@frappe.whitelist(methods=["GET"])
def get_student_effort(student: str) -> dict:
	require_faculty_for_student(student)
	effort = {}

	def note(assignment: str) -> frappe._dict:
		return effort.setdefault(
			assignment,
			frappe._dict(
				started_at=None,
				last_saved_at=None,
				seconds=None,
				runs=0,
				runs_to_pass=None,
				hints=0,
				pastes=0,
			),
		)

	def stretch(row: frappe._dict, started_at, saved_at) -> None:
		row.started_at = min((at for at in (row.started_at, started_at) if at), default=None)
		row.last_saved_at = max((at for at in (row.last_saved_at, saved_at) if at), default=None)

	for row in frappe.get_all(
		"CS17 Project",
		filters={"profile": student, "assignment": ["is", "set"]},
		fields=["assignment", "creation", "last_saved_at"],
	):
		stretch(note(row.assignment), row.creation, row.last_saved_at)

	snapshot = frappe.qb.DocType("CS17 Code Snapshot")
	for row in (
		frappe.qb.from_(snapshot)
		.select(
			snapshot.assignment,
			Min(snapshot.saved_at).as_("first_saved_at"),
			Max(snapshot.saved_at).as_("last_saved_at"),
		)
		.where((snapshot.student == student) & snapshot.assignment.isnotnull())
		.groupby(snapshot.assignment)
		.run(as_dict=True)
	):
		stretch(note(row.assignment), row.first_saved_at, row.last_saved_at)

	for row in frappe.get_all(
		"CS17 Code Run",
		filters={"student": student, "assignment": ["is", "set"]},
		fields=["assignment", "passed", "total"],
		order_by="ran_at asc",
	):
		assignment = note(row.assignment)
		assignment.runs += 1
		if assignment.runs_to_pass is None and row.total and row.passed == row.total:
			assignment.runs_to_pass = assignment.runs

	for doctype, key in (("CS17 Hint", "hints"), ("CS17 Paste", "pastes")):
		for assignment, count in frappe.get_all(
			doctype,
			filters={"student": student, "assignment": ["is", "set"]},
			fields=["assignment", {"COUNT": "name", "as": "count"}],
			group_by="assignment",
			as_list=True,
		):
			note(assignment)[key] = count

	submitted_at = dict(
		frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={"student": student, "docstatus": ["<", 2]},
			fields=["assignment", "submitted_at"],
			as_list=True,
		)
	)
	for assignment, row in effort.items():
		ended_at = submitted_at.get(assignment) or row.last_saved_at
		if row.started_at and ended_at:
			row.seconds = max(0, int(time_diff_in_seconds(ended_at, row.started_at)))
		del row.started_at, row.last_saved_at
	return effort
