from collections import Counter

import frappe
from frappe.query_builder.functions import Date
from frappe.utils import add_days, get_first_day_of_week, getdate, today

from cs17_portal.api import ASSIGNMENT_SUBMISSION, get_cohort_students


@frappe.whitelist(methods=["GET"])
def get_class_activity_week(cohort: str, date: str | None = None) -> dict:
	date = str(getdate(date or today()))
	start = get_first_day_of_week(date)
	days = [str(add_days(start, offset)) for offset in range(7)]
	students = get_cohort_students(cohort)
	names = [student.student for student in students] or [""]
	in_the_week = ["between", [days[0], days[-1]]]
	opened, worked, submitted = set(), set(), set()

	for row in frappe.get_all(
		"CS17 Project",
		filters={"profile": ["in", names], "assignment": ["is", "set"], "creation": in_the_week},
		fields=["profile", "assignment", "creation"],
	):
		opened.add((row.profile, str(getdate(row.creation)), row.assignment))

	for doctype, at in (("CS17 Code Snapshot", "saved_at"), ("CS17 Code Run", "ran_at")):
		table = frappe.qb.DocType(doctype)
		for row in (
			frappe.qb.from_(table)
			.select(table.student, table.assignment, Date(table[at]).as_("day"))
			.distinct()
			.where(
				table.student.isin(names)
				& table.assignment.isnotnull()
				& table[at][f"{days[0]} 00:00:00" : f"{days[-1]} 23:59:59.999999"]
			)
			.run(as_dict=True)
		):
			worked.add((row.student, str(row.day), row.assignment))

	for row in frappe.get_all(
		ASSIGNMENT_SUBMISSION,
		filters={"student": ["in", names], "submitted_at": in_the_week, "docstatus": ["<", 2]},
		fields=["student", "assignment", "submitted_at"],
	):
		submitted.add((row.student, str(getdate(row.submitted_at)), row.assignment))

	opened |= worked | submitted
	worked |= submitted

	opened, worked, submitted = (
		Counter((student, day) for student, day, _ in work) for work in (opened, worked, submitted)
	)
	rows = [
		{
			"student": student.student,
			"full_name": student.full_name,
			"days": [
				{
					"opened": opened[student.student, day],
					"worked": worked[student.student, day],
					"submitted": submitted[student.student, day],
				}
				for day in days
			],
		}
		for student in students
	]
	rows.sort(key=lambda row: sum(bool(day["opened"]) for day in row["days"]))
	return {"date": date, "days": days, "students": rows}
