import frappe


def get_context(context):
	settings = frappe.get_single("CS17 Portal Settings")
	context.quick_links = settings.quick_links
