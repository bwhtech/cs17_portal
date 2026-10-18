# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestAssignmentApi(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C190TEST")
		cls.faculty_user = make_user("faculty190@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 190")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_get_assignment_submissions_reports_a_missing_assignment_to_cohort_faculty(self):
		frappe.set_user(self.faculty_user)
		self.assertRaises(frappe.DoesNotExistError, api.get_assignment_submissions, "missing-assignment")

	def test_delete_assignment_reports_a_missing_assignment_to_faculty_without_a_cohort(self):
		faculty_user = make_user("faculty192@cs17test.com")
		make_profile("Faculty", None, faculty_user, "Faculty 192")

		frappe.set_user(faculty_user)
		self.assertRaises(frappe.DoesNotExistError, api.delete_assignment, "missing-assignment")

	def test_publish_assignment_reports_a_missing_assignment_to_faculty_without_a_cohort(self):
		faculty_user = make_user("faculty193@cs17test.com")
		make_profile("Faculty", None, faculty_user, "Faculty 193")

		frappe.set_user(faculty_user)
		self.assertRaisesRegex(
			frappe.DoesNotExistError, "Assignment not found", api.publish_assignment, "missing-assignment"
		)

	def test_update_assignment_reports_a_missing_assignment_to_faculty_without_a_cohort(self):
		faculty_user = make_user("faculty194@cs17test.com")
		make_profile("Faculty", None, faculty_user, "Faculty 194")

		frappe.set_user(faculty_user)
		self.assertRaisesRegex(
			frappe.DoesNotExistError,
			"Assignment not found",
			api.update_assignment,
			"missing-assignment",
			"PDF Task 194",
			self.cohort,
			"2030-01-01 00:00:00",
		)

	def test_update_assignment_keeps_the_description_the_caller_left_out(self):
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"PDF Task 190", self.cohort, "2030-01-01 00:00:00", description="Read chapter 2"
		)

		api.update_assignment(assignment, "PDF Task 190", self.cohort, "2030-02-01 00:00:00")

		self.assertEqual(frappe.db.get_value("CS17 Assignment", assignment, "description"), "Read chapter 2")

	def test_update_assignment_keeps_the_schedule_the_caller_sent_back(self):
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"PDF Task 191",
			self.cohort,
			"2030-01-01 00:00:00",
			publish="schedule",
			publish_on="2031-03-01 09:00:00",
		)

		api.update_assignment(
			assignment,
			"PDF Task 191 revised",
			self.cohort,
			"2030-01-01 00:00:00",
			publish="schedule",
			publish_on="2031-03-01 09:00:00",
		)

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment", assignment, ["title", "is_published", "publish_on"]),
			("PDF Task 191 revised", 0, frappe.utils.get_datetime("2031-03-01 09:00:00")),
		)

	def test_create_assignment_keeps_the_test_cases_in_order(self):
		frappe.set_user(self.faculty_user)
		test_cases = [
			{"input": "3\n", "expected_output": "9\n", "is_hidden": 0},
			{"input": "12\n", "expected_output": "144\n", "is_hidden": 1},
		]
		assignment = api.create_assignment(
			"Square a Number 195",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			test_cases=frappe.as_json(test_cases),
		)

		self.assertEqual(api.get_assignment(assignment).test_cases, test_cases)

	def test_update_assignment_refuses_a_save_from_an_older_copy(self):
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment("PDF Task 196", self.cohort, "2030-01-01 00:00:00")
		opened = str(frappe.db.get_value("CS17 Assignment", assignment, "modified"))
		api.update_assignment(assignment, "PDF Task 196 revised", self.cohort, "2030-01-01 00:00:00")

		self.assertRaises(
			frappe.TimestampMismatchError,
			api.update_assignment,
			assignment,
			"PDF Task 196 retitled",
			self.cohort,
			"2030-01-01 00:00:00",
			modified=opened,
		)
