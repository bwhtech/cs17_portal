import frappe
from frappe import _


@frappe.whitelist()
def get_user_profile() -> dict | None:
	return frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user},
		["name", "full_name", "profile_type", "cohort", "profile_picture"],
		as_dict=True,
	)


def _get_profile_or_throw(profile_type: str) -> str:
	filters: dict = {"user": frappe.session.user, "profile_type": profile_type}
	name = frappe.db.get_value("CS17 Profile", filters, "name")
	if not name:
		frappe.throw(_("No {0} profile found for current user").format(profile_type), frappe.PermissionError)
	return name


@frappe.whitelist()
def get_faculty_recent_submissions(limit: int = 5) -> list:
	faculty_name = _get_profile_or_throw(profile_type="Faculty")
	cohort = frappe.db.get_value("CS17 Profile", faculty_name, "cohort")
	if not cohort:
		return []
	return frappe.get_list(
		"CS17 Assignment Submission",
		filters=[["assignment.cohort", "=", cohort]],
		fields=["name", "student", "full_name", "assignment", "assignment_title", "submitted_at"],
		order_by="submitted_at desc",
		limit=int(limit),
		ignore_permissions=True,
	)


@frappe.whitelist()
def create_assignment(
	title: str,
	cohort: str,
	due_date: str,
	assignment_type: str,
	description: str = "",
	max_marks: float | None = None,
	remarks: str | None = None,
	is_published: int = 0,
	publish_on: str | None = None,
) -> dict:
	_get_profile_or_throw(profile_type="Faculty")
	doc = frappe.get_doc(
		{
			"doctype": "CS17 Assignment",
			"title": title,
			"cohort": cohort,
			"due_date": due_date,
			"assignment_type": assignment_type,
			"description": description,
			"max_marks": max_marks,
			"remarks": remarks,
			"is_published": is_published,
			"publish_on": publish_on,
		}
	)
	doc.insert(ignore_permissions=True)
	return {"name": doc.name}


def _check_deadline(assignment_name: str) -> None:
	due_date = frappe.db.get_value("CS17 Assignment", assignment_name, "due_date")
	if not due_date:
		return
	if frappe.utils.now_datetime() > due_date:
		frappe.throw(_("The deadline for this assignment has passed."))


@frappe.whitelist()
def submit_assignment(assignment: str, file_url: str) -> dict:
	student = _get_profile_or_throw(profile_type="Student")
	_check_deadline(assignment)

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
	student = _get_profile_or_throw(profile_type="Student")
	sub_doc = frappe.get_doc("CS17 Assignment Submission", submission)

	if sub_doc.student != student:
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	_check_deadline(sub_doc.assignment)

	sub_doc.submission_document = file_url
	sub_doc.save(ignore_permissions=True)
	return {"name": sub_doc.name}
