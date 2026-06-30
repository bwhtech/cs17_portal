import frappe


def execute():
	if frappe.db.table_exists("tabCS17 Student"):
		_migrate_students()
	if frappe.db.table_exists("tabCS17 Faculty"):
		_migrate_faculty()


def _migrate_students():
	students = frappe.get_all(
		"CS17 Student",
		fields=[
			"name",
			"first_name",
			"last_name",
			"full_name",
			"cohort",
			"user",
			"profile_picture",
			"date_of_birth",
			"blood_group",
			"address",
			"primary_phone",
			"alternate_phone",
		],
	)
	for s in students:
		if frappe.db.exists("CS17 Profile", s.name):
			continue
		frappe.get_doc({"doctype": "CS17 Profile", "profile_type": "Student", **s}).insert(
			ignore_permissions=True
		)


def _migrate_faculty():
	faculty_list = frappe.get_all(
		"CS17 Faculty",
		fields=["name", "first_name", "last_name", "full_name", "user", "profile_picture"],
	)
	for f in faculty_list:
		if frappe.db.exists("CS17 Profile", f.name):
			continue
		frappe.get_doc({"doctype": "CS17 Profile", "profile_type": "Faculty", **f}).insert(
			ignore_permissions=True
		)
