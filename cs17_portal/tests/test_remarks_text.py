# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	submit_assignment,
)
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_user


class TestRemarksText(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C350TEST")
		cls.faculty_user = make_user("faculty350@cs17test.com")
		cls.student_user = make_user("student350@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 350")
		make_profile("Student", cls.cohort, cls.student_user, "Student 350")

	def test_save_grade_keeps_tag_shaped_text_in_remarks(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "URL Task 350", "URL", 20)
		frappe.set_user(self.student_user)
		submission = submit_assignment(assignment, "https://example.com/greeting")["name"]
		frappe.set_user(self.faculty_user)

		grade = api.save_grade(submission, grade="B", remarks="Print it as `Hello, <name>!`")

		self.assertEqual(grade["remarks"], "Print it as `Hello, &lt;name>!`")
