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
def get_recent_submissions(faculty: str, limit: int = 5) -> list:
	profile = frappe.db.get_value("CS17 Profile", faculty, ["user", "cohort"], as_dict=True)
	if not profile or profile.user != frappe.session.user:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	if not profile.cohort:
		return []
	return frappe.get_list(
		"CS17 Assignment Submission",
		filters=[["assignment.cohort", "=", profile.cohort]],
		fields=["name", "student", "full_name", "assignment", "assignment_title", "submitted_at"],
		order_by="submitted_at desc",
		limit=limit,
		ignore_permissions=True,
	)


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
