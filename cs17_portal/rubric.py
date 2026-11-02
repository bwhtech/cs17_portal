import frappe

from cs17_portal.api import require_faculty_for_assignment


def get_rubric(assignment: str) -> list:
	return frappe.get_all(
		"CS17 Rubric Criterion",
		filters={"parent": assignment, "parenttype": "CS17 Assignment", "parentfield": "rubric"},
		fields=["criterion", "marks"],
		order_by="idx asc",
	)


@frappe.whitelist(methods=["GET"])
def get_assignment_rubric(assignment: str) -> list:
	require_faculty_for_assignment(assignment)
	return get_rubric(assignment)


def attach_rubric_scores(grades: list) -> None:
	if not grades:
		return
	scores_by_grade = {}
	for score in frappe.get_all(
		"CS17 Rubric Score",
		filters={"parenttype": "CS17 Assignment Grade", "parent": ("in", [grade.name for grade in grades])},
		fields=["parent", "criterion", "marks", "max_marks"],
		order_by="idx asc",
	):
		scores_by_grade.setdefault(score.pop("parent"), []).append(score)
	for grade in grades:
		grade.rubric_scores = scores_by_grade.get(grade.name, [])
