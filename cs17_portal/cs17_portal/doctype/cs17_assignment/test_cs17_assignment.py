# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.model.naming import set_new_name
from frappe.tests import IntegrationTestCase

from cs17_portal.tests.test_api import make_assignment, make_cohort, make_user

EXTRA_TEST_RECORD_DEPENDENCIES = []
IGNORE_TEST_RECORD_DEPENDENCIES = []


class IntegrationTestCS17Assignment(IntegrationTestCase):
	def test_cohort_resolves_in_assignment_and_submission_names(self):
		cohort = frappe.get_doc(
			{
				"doctype": "CS17 Cohort",
				"cohort_code": "TESTCOHORT",
				"start_date": "2026-01-01",
			}
		).insert(ignore_permissions=True)

		assignment = frappe.get_doc(
			{
				"doctype": "CS17 Assignment",
				"title": "Naming Series Regression",
				"assignment_type": "Graded",
				"remarks": "Grade",
				"cohort": cohort.name,
				"submission_type": "Any",
				"due_date": "2026-12-01 00:00:00",
				"naming_series": "GRADED-.{cohort}.-.###",
			}
		)
		# `set_new_name` is the framework entry point the old series broke: it baked the
		# literal `{cohort}` into the name instead of resolving the field.
		set_new_name(assignment)

		self.assertNotIn("{cohort}", assignment.name)
		self.assertIn(cohort.name, assignment.name)
		self.assertTrue(assignment.name.startswith(f"GRADED-{cohort.name}-"))

		submission = frappe.get_doc({"doctype": "CS17 Assignment Submission", "assignment": assignment.name})
		set_new_name(submission)

		self.assertNotIn("{cohort}", submission.name)
		self.assertEqual(submission.name, f"SUB-{assignment.name}-001")

	def test_system_manager_without_faculty_profile_creates_assignment(self):
		user = make_user("manager70@cs17test.com")
		frappe.get_doc("User", user).add_roles("System Manager")

		frappe.set_user(user)
		assignment = make_assignment(make_cohort("C70TEST"), "Desk Task 70", "PDF", 20)
		frappe.set_user("Administrator")

		self.assertTrue(frappe.db.exists("CS17 Assignment", assignment))

	def test_user_without_faculty_profile_cannot_create_assignment(self):
		cohort = make_cohort("C70TEST")

		frappe.set_user(make_user("visitor71@cs17test.com"))
		self.addCleanup(frappe.set_user, "Administrator")

		self.assertRaises(frappe.PermissionError, make_assignment, cohort, "Desk Task 71", "PDF", 20)
