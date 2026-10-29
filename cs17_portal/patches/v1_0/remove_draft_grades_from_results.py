import frappe

from cs17_portal.cs17_portal.doctype.cs17_assignment_grade.cs17_assignment_grade import get_student_grades


def execute():
	for result in frappe.get_all("CS17 Result", fields=["name", "student"]):
		rows = frappe.get_all(
			"CS17 Result Assignment Score",
			filters={"parent": result.name, "parenttype": "CS17 Result", "is_graded": 1},
			fields=["name", "assignment"],
		)
		grades = get_student_grades(result.student, [row.assignment for row in rows])
		for row in rows:
			if not grades.get(row.assignment, {}).get("grade_name"):
				frappe.db.set_value(
					"CS17 Result Assignment Score",
					row.name,
					{"marks_obtained": 0, "grade": None, "remarks": None, "is_graded": 0},
					update_modified=False,
				)
