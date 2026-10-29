# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestAssignmentSubmissionNames(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cohort = make_cohort("C360TEST")
		cls.faculty_user = make_user("faculty360@cs17test.com")
		make_profile("Faculty", cohort, cls.faculty_user, "Faculty 360")
		first_student = make_profile("Student", cohort, make_user("student360@cs17test.com"), "Student 360")
		second_student = make_profile("Student", cohort, make_user("student361@cs17test.com"), "Student 361")

		frappe.set_user(cls.faculty_user)
		cls.assignment = make_assignment(cohort, "PDF Task 360", "PDF", 20)
		frappe.set_user("Administrator")

		cls.later = make_submission(cls.assignment, first_student, "Student 360", "PDF Task 360")
		frappe.db.set_value("CS17 Assignment Submission", cls.later, "submitted_at", "2026-02-02 10:00:00")
		cls.earlier = make_submission(cls.assignment, second_student, "Student 361", "PDF Task 360")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")

	def test_lists_the_latest_submission_first(self):
		frappe.set_user(self.faculty_user)

		self.assertEqual(api.get_assignment_submission_names(self.assignment), [self.later, self.earlier])

	def test_refuses_faculty_of_another_cohort(self):
		other_faculty = make_user("faculty362@cs17test.com")
		make_profile("Faculty", make_cohort("C362TEST"), other_faculty, "Faculty 362")
		frappe.set_user(other_faculty)

		self.assertRaises(frappe.PermissionError, api.get_assignment_submission_names, self.assignment)
