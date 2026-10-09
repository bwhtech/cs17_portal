import frappe
from frappe.model.utils.rename_field import rename_field


def execute():
	if not frappe.db.has_column("CS17 Project", "student"):
		return
	rename_field("CS17 Project", "student", "profile")
