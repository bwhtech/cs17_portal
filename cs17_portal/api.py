import frappe
from frappe import _

@frappe.whitelist()
def get_current_student() -> dict | None:
	user = frappe.session.user
	students = frappe.get_list(
		"CS17 Student",
		filters={"user": user},
		fields=["name", "full_name", "cohort", "profile_picture"],
		limit=1,
	)
	if students:
		return students[0]
	return None


@frappe.whitelist()
def submit_assignment(assignment: str, file_url: str) -> dict:
	student_list = frappe.get_list(
		"CS17 Student",
		filters={"user": frappe.session.user},
		fields=["name"],
		limit=1,
	)
	if not student_list:
		frappe.throw(_("No student record found for current user"))

	student = student_list[0].name

	doc = frappe.get_doc(
		{
			"doctype": "CS17 Assignment Submission",
			"naming_series": "SUB-.###.{assignment}",
			"student": student,
			"assignment": assignment,
			"submission_document": file_url,
			"submitted_at": frappe.utils.now_datetime(),
		}
	)
	doc.insert(ignore_permissions=True)
	return {"name": doc.name}
