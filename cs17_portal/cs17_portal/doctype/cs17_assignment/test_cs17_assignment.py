# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.model.naming import set_new_name
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, now_datetime

from cs17_portal.api import create_assignment, update_assignment
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import get_quarter_assignments
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_user

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

	def test_published_assignment_cannot_go_back_to_draft(self):
		assignment = frappe.get_doc(
			"CS17 Assignment", make_assignment(make_cohort("C70TEST"), "Desk Task 72", "PDF", 20)
		)
		assignment.is_published = 0

		self.assertRaises(frappe.ValidationError, assignment.save)

	def test_published_assignment_cannot_be_edited(self):
		cohort = make_cohort("C70TEST")
		faculty_user = make_user("faculty73@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 73")

		frappe.set_user(faculty_user)
		self.addCleanup(frappe.set_user, "Administrator")
		assignment = create_assignment("PDF Task 73", cohort, "2030-01-01 00:00:00", publish="now")

		self.assertRaises(
			frappe.ValidationError,
			update_assignment,
			assignment,
			"PDF Task 73",
			cohort,
			"2030-02-01 00:00:00",
			publish="now",
		)

	def test_scheduled_assignment_not_yet_due_can_go_back_to_draft(self):
		name = make_assignment(make_cohort("C70TEST"), "Desk Task 74", "PDF", 20)
		frappe.db.set_value(
			"CS17 Assignment", name, {"is_published": 0, "publish_on": add_days(now_datetime(), 1)}
		)

		assignment = frappe.get_doc("CS17 Assignment", name)
		assignment.publish_on = None
		assignment.save()

		self.assertIsNone(frappe.db.get_value("CS17 Assignment", name, "publish_on"))


class TestQuarterAssignments(IntegrationTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_assignment_past_its_publish_time_is_listed(self):
		cohort = make_cohort("C60TEST")
		faculty_user = make_user("faculty60@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 60")
		quarter = (
			frappe.get_doc({"doctype": "CS17 Quarter", "quarter_name": "Quarter 60"})
			.insert(ignore_permissions=True)
			.name
		)

		frappe.set_user(faculty_user)
		assignment = make_assignment(cohort, "PDF Task 60", "PDF", 20)
		frappe.db.set_value(
			"CS17 Assignment",
			assignment,
			{"quarter": quarter, "is_published": 0, "publish_on": add_days(now_datetime(), -1)},
		)

		self.assertEqual([row.name for row in get_quarter_assignments(quarter, cohort)], [assignment])
