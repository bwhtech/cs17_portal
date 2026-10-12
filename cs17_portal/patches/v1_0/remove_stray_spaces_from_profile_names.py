import frappe
from frappe.utils import cstr


def execute():
	profiles = frappe.get_all("CS17 Profile", fields=["name", "first_name", "last_name", "full_name"])
	for profile in profiles:
		names = {
			fieldname: " ".join(cstr(profile[fieldname]).split()) for fieldname in ("first_name", "last_name")
		}
		names["full_name"] = " ".join(name for name in names.values() if name)
		changed = {
			fieldname: value for fieldname, value in names.items() if value != cstr(profile[fieldname])
		}
		if not changed:
			continue
		frappe.db.set_value("CS17 Profile", profile.name, changed, update_modified=False)
		if "full_name" not in changed:
			continue

		full_name = names["full_name"]
		submissions = frappe.get_all(
			"CS17 Assignment Submission", filters={"student": profile.name}, pluck="name"
		)
		frappe.db.set_value(
			"CS17 Assignment Submission",
			{"student": profile.name},
			"full_name",
			full_name,
			update_modified=False,
		)
		frappe.db.set_value(
			"CS17 Assignment Grade",
			{"submission": ["in", submissions]},
			"full_name",
			full_name,
			update_modified=False,
		)
		for doctype in ("CS17 Result", "CS17 Subject Marks"):
			frappe.db.set_value(
				doctype, {"student": profile.name}, "student_name", full_name, update_modified=False
			)
