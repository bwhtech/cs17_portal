import frappe
from frappe import _
from frappe.query_builder.functions import Count

from cs17_portal.api import get_cohort_students

ERRORS_PER_TOPIC = 5


@frappe.whitelist(methods=["GET"])
def get_common_errors(cohort: str, quarter: str | None = None) -> list:
	names = [student.student for student in get_cohort_students(cohort)] or [""]
	run = frappe.qb.DocType("CS17 Code Run")
	assignment = frappe.qb.DocType("CS17 Assignment")
	students = Count(run.student).distinct().as_("students")
	query = (
		frappe.qb.from_(run)
		.join(assignment)
		.on(assignment.name == run.assignment)
		.select(
			assignment.topic,
			run.assignment,
			assignment.title,
			run.error_type,
			run.error_line,
			students,
		)
		.where((assignment.cohort == cohort) & run.student.isin(names) & (run.error_type != ""))
		.groupby(assignment.topic, run.assignment, assignment.title, run.error_type, run.error_line)
		.orderby(students, order=frappe.qb.desc)
		.orderby(assignment.title, run.error_line)
	)
	if quarter:
		query = query.where(assignment.quarter == quarter)

	shown = {}
	rows = []
	for row in query.run(as_dict=True):
		row.topic = row.topic or _("No topic")
		shown[row.topic] = shown.get(row.topic, 0) + 1
		if shown[row.topic] <= ERRORS_PER_TOPIC:
			rows.append(row)
	return rows
