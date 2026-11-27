import frappe
from frappe.query_builder.functions import Max
from frappe.utils import getdate, today

from cs17_portal.api import ASSIGNMENT_SUBMISSION, get_cohort_students


@frappe.whitelist(methods=["GET"])
def get_class_activity(cohort: str, date: str | None = None) -> dict:
	return summarize_class_activity(get_cohort_students(cohort), date)


def summarize_class_activity(students: list, date: str | None = None) -> dict:
	date = str(getdate(date or today()))
	names = [student.student for student in students] or [""]
	on_the_day = ["between", [date, date]]
	work = {}

	def note(student: str, assignment: str, at) -> frappe._dict:
		row = work.setdefault(
			(student, assignment),
			frappe._dict(
				assignment=assignment,
				typed=False,
				runs=0,
				passed=None,
				total=None,
				submitted=False,
				last_active_at=at,
			),
		)
		row.last_active_at = max(row.last_active_at, at)
		return row

	for row in frappe.get_all(
		"CS17 Project",
		filters={"profile": ["in", names], "assignment": ["is", "set"], "creation": on_the_day},
		fields=["profile", "assignment", "creation"],
	):
		note(row.profile, row.assignment, row.creation)

	snapshot = frappe.qb.DocType("CS17 Code Snapshot")
	for row in (
		frappe.qb.from_(snapshot)
		.select(snapshot.student, snapshot.assignment, Max(snapshot.saved_at).as_("saved_at"))
		.where(
			snapshot.student.isin(names)
			& snapshot.assignment.isnotnull()
			& snapshot.saved_at[f"{date} 00:00:00" : f"{date} 23:59:59.999999"]
		)
		.groupby(snapshot.student, snapshot.assignment)
		.run(as_dict=True)
	):
		note(row.student, row.assignment, row.saved_at).typed = True

	for row in frappe.get_all(
		"CS17 Code Run",
		filters={"student": ["in", names], "assignment": ["is", "set"], "ran_at": on_the_day},
		fields=["student", "assignment", "ran_at", "passed", "total"],
		order_by="ran_at asc",
	):
		assignment = note(row.student, row.assignment, row.ran_at)
		assignment.runs += 1
		if row.total:
			assignment.passed, assignment.total = row.passed, row.total

	for row in frappe.get_all(
		ASSIGNMENT_SUBMISSION,
		filters={"student": ["in", names], "submitted_at": on_the_day, "docstatus": ["<", 2]},
		fields=["student", "assignment", "submitted_at"],
	):
		note(row.student, row.assignment, row.submitted_at).submitted = True

	titles = dict(
		frappe.get_all(
			"CS17 Assignment",
			filters={"name": ["in", [assignment for _, assignment in work] or [""]]},
			fields=["name", "title"],
			as_list=True,
		)
	)
	by_student = {}
	for (student, assignment), row in work.items():
		row.title = titles.get(assignment) or assignment
		by_student.setdefault(student, []).append(row)

	rows = []
	for student in students:
		assignments = sorted(by_student.get(student.student, []), key=lambda row: row.last_active_at)
		rows.append(
			{
				"student": student.student,
				"full_name": student.full_name,
				"opened": len(assignments),
				"typed": sum(row.typed for row in assignments),
				"ran": sum(bool(row.runs) for row in assignments),
				"submitted": sum(row.submitted for row in assignments),
				"last_active_at": assignments[-1].last_active_at if assignments else None,
				"assignments": assignments,
			}
		)
	rows.sort(key=lambda row: (bool(row["opened"]), row["submitted"]))
	return {"date": date, "students": rows}
