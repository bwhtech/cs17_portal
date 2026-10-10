import frappe

from cs17_portal.cs17_portal.doctype.cs17_assignment_grade.cs17_assignment_grade import get_grade_for_marks
from cs17_portal.cs17_portal.doctype.cs17_grading_scale.cs17_grading_scale import get_default_scale


def execute():
	scale = get_default_scale()
	grades = frappe.get_all(
		"CS17 Assignment Grade",
		filters={"assignment.remarks": "Marks"},
		fields=["name", "marks_obtained", "assignment.max_marks"],
	)
	for grade in grades:
		frappe.db.set_value(
			"CS17 Assignment Grade",
			grade.name,
			"grade",
			get_grade_for_marks(grade.marks_obtained, grade.max_marks, scale),
			update_modified=False,
		)
