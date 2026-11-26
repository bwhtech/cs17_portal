# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api, sudden_code
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user

SOLUTION_LINES = [
	"n = int(input())",
	"total = 0",
	"for digit in str(n):",
	"    total += int(digit) ** len(str(n))",
	"if total == n:",
	"    print('Armstrong')",
	"else:",
	"    print('Not Armstrong')",
]


class TestSuddenCode(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C630TEST")
		cls.faculty_user = make_user("faculty630@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student630@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.other_faculty_user = make_user("faculty631@cs17test.com")
		make_profile("Faculty", make_cohort("C631TEST"), cls.other_faculty_user, "Rohan Mehta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Armstrong numbers", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)

	def submit_after_saves(self, saves: list[int]) -> str:
		frappe.set_user(self.student_user)
		project = api.start_python_assignment(self.assignment)["name"]
		for line_count in saves:
			api.save_python_project(project, "\n".join(SOLUTION_LINES[:line_count]))
		submission = api.submit_python_project(self.assignment, project)["name"]
		frappe.set_user(self.faculty_user)
		return submission

	def test_gradual_typing_is_not_flagged(self):
		submission = self.submit_after_saves([2, 4, 6, 8])

		self.assertNotIn(submission, sudden_code.get_sudden_code(self.assignment))

	def test_solution_in_one_save_is_flagged(self):
		submission = self.submit_after_saves([8])

		self.assertIn(submission, sudden_code.get_sudden_code(self.assignment))

	def test_refuses_a_student(self):
		frappe.set_user(self.student_user)

		self.assertRaises(frappe.PermissionError, sudden_code.get_sudden_code, self.assignment)

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, sudden_code.get_sudden_code, self.assignment)
