import frappe


def execute():
	submitted = frappe.get_all("CS17 Assignment Submission", filters={"docstatus": 1}, pluck="name")
	for name in submitted:
		frappe.db.set_value("CS17 Assignment Submission", name, "docstatus", 0, update_modified=False)
