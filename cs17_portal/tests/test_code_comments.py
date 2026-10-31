# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api, code_comments
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user

CODE = "total = 0\nfor price in prices:\n    total = total + price\nprint(total)\n"


class TestCodeComments(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C930TEST")
		cls.faculty_user = make_user("faculty930@cs17test.com")
		cls.other_faculty_user = make_user("faculty931@cs17test.com")
		cls.student_user = make_user("student930@cs17test.com")
		cls.other_student_user = make_user("student931@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Priya Nair")
		make_profile("Faculty", cls.cohort, cls.other_faculty_user, "Rohan Mehta")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		make_profile("Student", cls.cohort, cls.other_student_user, "Diya Patel")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		assignment = make_assignment(self.cohort, "Loops practice", "Python", 20)
		self.submission = make_submission(assignment, self.student, "Aarav Sharma", "Loops practice")
		frappe.db.set_value("CS17 Assignment Submission", self.submission, "code", CODE)
		frappe.set_user(self.faculty_user)
		code_comments.add_code_comment(self.submission, 3, "Use total += price.")

	def test_comment_shows_on_its_line(self):
		self.assertEqual(
			[(row.line, row.comment) for row in code_comments.get_code_comments(self.submission)],
			[(3, "Use total += price.")],
		)

	def test_comment_on_a_line_outside_the_code_is_refused(self):
		self.assertRaises(
			frappe.ValidationError, code_comments.add_code_comment, self.submission, 5, "Add a docstring."
		)

	def test_another_faculty_cannot_edit_the_comment(self):
		comment = code_comments.get_code_comments(self.submission)[0].name
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(
			frappe.PermissionError, code_comments.update_code_comment, comment, "Looks fine to me."
		)

	def test_resubmitted_code_shows_no_earlier_comments(self):
		frappe.db.set_value(
			"CS17 Assignment Submission",
			self.submission,
			{"code": "print(sum(prices))\n", "submitted_at": "2026-02-02 10:00:00"},
		)

		self.assertEqual(code_comments.get_code_comments(self.submission), [])

	def test_student_does_not_see_comments_before_the_grade_is_published(self):
		api.grade_submission(self.submission, marks_obtained=15)
		frappe.set_user(self.student_user)

		self.assertEqual(code_comments.get_student_code_comments(self.submission), [])

	def test_student_sees_the_commented_line_once_the_grade_is_published(self):
		api.grade_submission(self.submission, marks_obtained=15, publish="now")
		frappe.set_user(self.student_user)

		self.assertEqual(
			[
				(row.line, row.code, row.comment)
				for row in code_comments.get_student_code_comments(self.submission)
			],
			[(3, "total = total + price", "Use total += price.")],
		)

	def test_another_student_cannot_read_the_comments(self):
		api.grade_submission(self.submission, marks_obtained=15, publish="now")
		frappe.set_user(self.other_student_user)

		self.assertRaises(frappe.DoesNotExistError, code_comments.get_student_code_comments, self.submission)
