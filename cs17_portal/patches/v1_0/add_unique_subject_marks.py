import frappe


def execute():
	frappe.db.add_unique("CS17 Subject Marks", ["exam", "student", "subject"])
