import frappe
from frappe.query_builder.functions import Count, Date
from frappe.utils import add_days, getdate, today

from cs17_portal.api import ASSIGNMENT_SUBMISSION
from cs17_portal.guardian import require_faculty_for_student

CALENDAR_DAYS = 12 * 7


@frappe.whitelist(methods=["GET"])
def get_student_activity_calendar(student: str) -> dict:
	require_faculty_for_student(student)
	end = getdate(today())
	start = add_days(end, -(CALENDAR_DAYS - 1))
	days = {}
	for doctype, field, count in (
		("CS17 Code Snapshot", "saved_at", "saves"),
		("CS17 Code Run", "ran_at", "runs"),
		(ASSIGNMENT_SUBMISSION, "submitted_at", "submissions"),
	):
		table = frappe.qb.DocType(doctype)
		query = (
			frappe.qb.from_(table)
			.select(Date(table[field]).as_("date"), Count("*").as_("count"))
			.where((table.student == student) & (table[field] >= start))
			.groupby(Date(table[field]))
		)
		if doctype == ASSIGNMENT_SUBMISSION:
			query = query.where(table.docstatus < 2)
		for row in query.run(as_dict=True):
			day = days.setdefault(
				str(row.date), {"date": str(row.date), "saves": 0, "runs": 0, "submissions": 0}
			)
			day[count] = row.count
	return {"start": str(start), "end": str(end), "days": sorted(days.values(), key=lambda day: day["date"])}
