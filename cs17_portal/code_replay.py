import frappe
from frappe import _

from cs17_portal.api import ASSIGNMENT_SUBMISSION, require_faculty_for_assignment


@frappe.whitelist(methods=["GET"])
def get_code_snapshots(submission: str) -> dict:
	submission_doc = frappe.db.get_value(
		ASSIGNMENT_SUBMISSION, submission, ["assignment", "student", "project"], as_dict=True
	)
	if not submission_doc:
		frappe.throw(_("Submission not found"), frappe.DoesNotExistError)
	require_faculty_for_assignment(submission_doc.assignment)
	student_work = {"assignment": submission_doc.assignment, "student": submission_doc.student}
	return {
		"snapshots": frappe.get_all(
			"CS17 Code Snapshot",
			filters={"project": submission_doc.project},
			fields=["saved_at", "code"],
			order_by="saved_at asc",
		),
		"tab_leaves": frappe.get_all(
			"CS17 Tab Leave", filters=student_work, pluck="left_at", order_by="left_at asc"
		),
		"pastes": frappe.get_all(
			"CS17 Paste",
			filters=student_work,
			fields=["pasted_at", "line_count"],
			order_by="pasted_at asc",
		),
	}
