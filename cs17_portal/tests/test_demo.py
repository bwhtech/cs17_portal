# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import now_datetime

from cs17_portal import demo
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestDemoWipe(FrappeTestCase):
	def test_wipe_deletes_a_demo_students_attempts_tab_leaves_and_pastes(self):
		cohort = make_cohort("C289TEST")
		student = make_profile("Student", cohort, make_user("student289@demo.cs17test.com"), "Student 289")
		assignment = make_assignment(cohort, "Scratch Task 289", "Scratch", 20)
		frappe.get_doc(
			{
				"doctype": "CS17 Assignment Attempt",
				"assignment": assignment,
				"student": student,
				"started_at": now_datetime(),
			}
		).insert(ignore_permissions=True)
		frappe.get_doc({"doctype": "CS17 Tab Leave", "assignment": assignment, "student": student}).insert(
			ignore_permissions=True
		)
		frappe.get_doc({"doctype": "CS17 Paste", "assignment": assignment, "student": student}).insert(
			ignore_permissions=True
		)

		with (
			patch.multiple(demo, DOMAIN="@demo.cs17test.com", COHORT_NOW=cohort, COHORT_PAST=cohort),
			patch.object(frappe.db, "commit"),
			patch.object(frappe.db, "rollback"),
		):
			demo.wipe()

		self.assertFalse(frappe.db.exists("CS17 Assignment Attempt", {"student": student}))
		self.assertFalse(frappe.db.exists("CS17 Tab Leave", {"student": student}))
		self.assertFalse(frappe.db.exists("CS17 Paste", {"student": student}))

	def test_wipe_deletes_comments_on_a_demo_students_code(self):
		cohort = make_cohort("C932TEST")
		student = make_profile("Student", cohort, make_user("student932@demo.cs17test.com"), "Kabir Rao")
		assignment = make_assignment(cohort, "Loops practice", "Python", 20)
		submission = make_submission(assignment, student, "Kabir Rao", "Loops practice")
		comment = (
			frappe.get_doc(
				{
					"doctype": "CS17 Code Comment",
					"submission": submission,
					"line": 1,
					"comment": "Name it total.",
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

		with (
			patch.multiple(demo, DOMAIN="@demo.cs17test.com", COHORT_NOW=cohort, COHORT_PAST=cohort),
			patch.object(frappe.db, "commit"),
			patch.object(frappe.db, "rollback"),
		):
			demo.wipe()

		self.assertFalse(frappe.db.exists("CS17 Code Comment", comment))
