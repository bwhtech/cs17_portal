# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.celebration import get_celebration
from cs17_portal.tests.test_api import make_cohort, make_profile, make_submission, make_user


class TestCelebration(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C742TEST")
		cls.faculty_user = make_user("faculty742@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student742@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Squares practice",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			assignment_type="Graded",
			max_marks=10,
			remarks="Marks",
			publish="now",
			test_cases=frappe.as_json(
				[
					{"input": "3\n", "expected_output": "9\n", "is_hidden": 0},
					{"input": "4\n", "expected_output": "16\n", "is_hidden": 1},
				]
			),
		)
		self.submission = make_submission(self.assignment, self.student, "Aarav Sharma", "Squares practice")

	def get_celebration_after_grading(self, marks: float, publish: str | None = "now") -> dict:
		frappe.set_user(self.faculty_user)
		api.grade_submission(self.submission, marks_obtained=marks, publish=publish)
		frappe.set_user(self.student_user)
		return get_celebration(self.assignment)

	def test_full_marks_is_flawless_and_counts_the_hidden_tests(self):
		self.assertEqual(
			self.get_celebration_after_grading(10), {"flawless": True, "first_try": True, "tests": 2}
		)

	def test_a_failed_test_run_before_submitting_is_not_first_try(self):
		frappe.get_doc(
			{
				"doctype": "CS17 Code Run",
				"assignment": self.assignment,
				"student": self.student,
				"ran_at": "2026-02-01 09:00:00",
				"passed": 1,
				"total": 2,
			}
		).insert(ignore_permissions=True)

		self.assertFalse(self.get_celebration_after_grading(10)["first_try"])

	def test_less_than_full_marks_is_not_flawless(self):
		self.assertEqual(self.get_celebration_after_grading(9), {"flawless": False})

	def test_an_unpublished_grade_is_not_celebrated(self):
		self.assertEqual(self.get_celebration_after_grading(10, publish=None), {"flawless": False})
