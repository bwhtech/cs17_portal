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


def _get_student_or_throw() -> str:
	student_list = frappe.get_list(
		"CS17 Student",
		filters={"user": frappe.session.user},
		fields=["name"],
		limit=1,
	)
	if not student_list:
		frappe.throw(_("No student record found for current user"))
	return student_list[0].name


def _check_deadline(assignment_name: str) -> None:
	due_date = frappe.db.get_value("CS17 Assignment", assignment_name, "due_date")
	if not due_date:
		return
	if frappe.utils.now_datetime() > due_date:
		frappe.throw(_("The deadline for this assignment has passed."))


@frappe.whitelist()
def submit_assignment(assignment: str, file_url: str) -> dict:
	_check_deadline(assignment)
	student = _get_student_or_throw()

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


@frappe.whitelist()
def edit_submission(submission: str, file_url: str) -> dict:
	sub_doc = frappe.get_doc("CS17 Assignment Submission", submission)
	_check_deadline(sub_doc.assignment)

	sub_doc.submission_document = file_url
	sub_doc.save(ignore_permissions=True)
	return {"name": sub_doc.name}