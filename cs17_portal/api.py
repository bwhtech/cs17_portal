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


def get_current_profile_name(profile_type: str) -> str | None:
	"""Return the current user's profile name for the given type, or None."""
	return frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user, "profile_type": profile_type},
		"name",
	)


def validate_membership(profile_type: str) -> None:
	"""Throw if the current user has no profile of the given type."""
	if not get_current_profile_name(profile_type):
		frappe.throw(
			_("No {0} profile found for current user").format(profile_type),
			frappe.PermissionError,
		)


@frappe.whitelist()
def get_recent_submissions(faculty: str, limit: int = 5) -> list:
	profile = frappe.get_doc("CS17 Profile", faculty)
	if profile.user != frappe.session.user:
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
