# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


def make_python_submission(assignment: str, student: str, code: str) -> str:
	submission = make_submission(assignment, student, student, "Python Task 870")
	frappe.db.set_value("CS17 Assignment Submission", submission, "code", code)
	return submission


class TestSimilarSubmissions(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C870TEST")
		cls.faculty_user = make_user("faculty870@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 870")
		cls.first_student = make_profile(
			"Student", cls.cohort, make_user("student870@cs17test.com"), "Student 870"
		)
		cls.second_student = make_profile(
			"Student", cls.cohort, make_user("student871@cs17test.com"), "Student 871"
		)

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		self.assignment = make_assignment(self.cohort, "Python Task 870", "Python", 20)

	def test_lists_code_that_differs_only_in_comments_and_spacing(self):
		first = make_python_submission(self.assignment, self.first_student, "total = a + b\nprint(total)\n")
		second = make_python_submission(
			self.assignment, self.second_student, "# add them\ntotal=a+b\n\nprint( total )  # show it\n"
		)
		frappe.set_user(self.faculty_user)

		pairs = api.get_similar_submissions(self.assignment)

		self.assertEqual(
			[({row.name for row in pair["submissions"]}, pair["similarity"]) for pair in pairs],
			[({first, second}, 1.0)],
		)

	def test_leaves_out_lines_from_the_starter_code(self):
		frappe.db.set_value(
			"CS17 Assignment", self.assignment, "starter_code", "a = int(input())\nb = int(input())\n"
		)
		make_python_submission(
			self.assignment, self.first_student, "a = int(input())\nb = int(input())\nprint(a + b)\n"
		)
		make_python_submission(
			self.assignment, self.second_student, "a = int(input())\nb = int(input())\nprint(a * b)\n"
		)
		frappe.set_user(self.faculty_user)

		self.assertEqual(api.get_similar_submissions(self.assignment), [])

	def test_refuses_faculty_of_another_cohort(self):
		other_faculty = make_user("faculty872@cs17test.com")
		make_profile("Faculty", make_cohort("C872TEST"), other_faculty, "Faculty 872")
		frappe.set_user(other_faculty)

		self.assertRaises(frappe.PermissionError, api.get_similar_submissions, self.assignment)
