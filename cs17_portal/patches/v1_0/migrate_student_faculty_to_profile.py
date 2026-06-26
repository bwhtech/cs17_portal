"""
Migrate CS17 Student and CS17 Faculty records into CS17 Profile.

- Existing CS17 Student rows are inserted as CS17 Profile with profile_type = "Student"
- Existing CS17 Faculty rows are inserted as CS17 Profile with profile_type = "Faculty"
- Original document names are preserved so CS17 Assignment Submission.student links remain valid
"""

import frappe


def execute():
	if not frappe.db.table_exists("tabCS17 Student") and not frappe.db.table_exists("tabCS17 Faculty"):
		return

	# Migrate students
	if frappe.db.table_exists("tabCS17 Student"):
		students = frappe.db.sql(
			"""
			SELECT name, first_name, last_name, full_name, cohort, user,
			       profile_picture, date_of_birth, blood_group, address,
			       primary_phone, alternate_phone, creation, modified, owner
			FROM `tabCS17 Student`
			""",
			as_dict=True,
		)
		for s in students:
			if frappe.db.exists("CS17 Profile", s.name):
				continue
			frappe.db.insert(
				"CS17 Profile",
				{
					"name": s.name,
					"profile_type": "Student",
					"first_name": s.first_name,
					"last_name": s.last_name,
					"full_name": s.full_name,
					"cohort": s.cohort,
					"user": s.user,
					"profile_picture": s.profile_picture,
					"date_of_birth": s.date_of_birth,
					"blood_group": s.blood_group,
					"address": s.address,
					"primary_phone": s.primary_phone,
					"alternate_phone": s.alternate_phone,
					"creation": s.creation,
					"modified": s.modified,
					"owner": s.owner,
				},
			)

	# Migrate faculty
	if frappe.db.table_exists("tabCS17 Faculty"):
		faculty_list = frappe.db.sql(
			"""
			SELECT name, first_name, last_name, full_name, user,
			       profile_picture, creation, modified, owner
			FROM `tabCS17 Faculty`
			""",
			as_dict=True,
		)
		for f in faculty_list:
			if frappe.db.exists("CS17 Profile", f.name):
				continue
			frappe.db.insert(
				"CS17 Profile",
				{
					"name": f.name,
					"profile_type": "Faculty",
					"first_name": f.first_name,
					"last_name": f.last_name,
					"full_name": f.full_name,
					"user": f.user,
					"profile_picture": f.profile_picture,
					"creation": f.creation,
					"modified": f.modified,
					"owner": f.owner,
				},
			)
