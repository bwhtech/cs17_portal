import frappe


def execute():
	frappe.db.add_unique("CS17 Result", ["exam", "student"])
