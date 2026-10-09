from urllib.parse import quote

import frappe

no_cache = 1


def get_context(context):
	assignment = frappe.form_dict.get("assignment")
	frappe.local.flags.redirect_location = (
		f"/dashboard/assignments/{quote(assignment, safe='')}/submission"
		if assignment
		else "/dashboard/assignments"
	)
	raise frappe.Redirect
