import frappe
from frappe import _
from frappe.utils import format_datetime, now_datetime

no_cache = 1


def get_context(context):
	if frappe.session.user == "Guest":
		assignment_name = frappe.form_dict.get("assignment", "")
		frappe.local.flags.redirect_location = f"/login?redirect-to=/submission?assignment={assignment_name}"
		raise frappe.Redirect

	assignment_name = frappe.form_dict.get("assignment")
	if not assignment_name:
		frappe.throw(_("Assignment not specified"), frappe.DoesNotExistError)

	assignment = frappe.get_doc("CS17 Assignment", assignment_name)
	context.assignment = assignment
	context.due_date_display = format_datetime(assignment.due_date)
	context.is_overdue = now_datetime() > assignment.due_date

	profiles = frappe.get_list(
		"CS17 Profile",
		filters={"user": frappe.session.user, "profile_type": "Student"},
		fields=["name"],
		limit=1,
		ignore_permissions=True,
	)

	context.existing_submission = None
	if profiles:
		submissions = frappe.get_list(
			"CS17 Assignment Submission",
			filters={"student": profiles[0].name, "assignment": assignment_name},
			fields=["name", "submitted_at"],
			limit=1,
			ignore_permissions=True,
		)
		if submissions:
			sub = submissions[0]
			sub.submitted_at_display = format_datetime(sub.submitted_at)
			context.existing_submission = sub
