import frappe
from frappe.utils import flt

from cs17_portal.api import ASSIGNMENT_SUBMISSION, is_published_now, require_current_student


@frappe.whitelist(methods=["GET"])
def get_celebration(assignment: str) -> dict:
	student = require_current_student()
	submission = frappe.db.get_value(
		ASSIGNMENT_SUBMISSION,
		{"assignment": assignment, "student": student},
		["name", "submitted_at"],
		as_dict=True,
	)
	grade = submission and frappe.db.get_value(
		"CS17 Assignment Grade",
		{"submission": submission.name},
		["marks_obtained", "is_published", "published_on"],
		as_dict=True,
	)
	if not (grade and is_published_now(grade, "published_on")):
		return {"flawless": False}

	details = frappe.db.get_value(
		"CS17 Assignment", assignment, ["submission_type", "remarks", "max_marks"], as_dict=True
	)
	tests = frappe.db.count(
		"CS17 Python Test Case",
		{"parent": assignment, "parenttype": "CS17 Assignment", "parentfield": "test_cases"},
	)
	if not (
		details.submission_type == "Python"
		and details.remarks == "Marks"
		and tests
		and flt(grade.marks_obtained) == flt(details.max_marks)
	):
		return {"flawless": False}

	run = frappe.qb.DocType("CS17 Code Run")
	failed_before = (
		frappe.qb.from_(run)
		.select(run.name)
		.where(
			(run.assignment == assignment)
			& (run.student == student)
			& (run.passed < run.total)
			& (run.ran_at < submission.submitted_at)
		)
		.limit(1)
		.run()
	)
	return {"flawless": True, "first_try": not failed_before, "tests": tests}
