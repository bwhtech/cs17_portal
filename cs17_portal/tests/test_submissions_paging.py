# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestCohortSubmissionsPaging(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cohort = make_cohort("C397TEST")
		cls.faculty_user = make_user("faculty397@cs17test.com")
		make_profile("Faculty", cohort, cls.faculty_user, "Faculty 397")
		first_student = make_profile("Student", cohort, make_user("student397@cs17test.com"), "Student 397")
		second_student = make_profile("Student", cohort, make_user("student398@cs17test.com"), "Student 398")

		frappe.set_user(cls.faculty_user)
		assignment = make_assignment(cohort, "PDF Task 397", "PDF", 20)
		frappe.set_user("Administrator")

		cls.later = make_submission(assignment, first_student, "Student 397", "PDF Task 397")
		frappe.db.set_value("CS17 Assignment Submission", cls.later, "submitted_at", "2026-02-02 10:00:00")
		make_submission(assignment, second_student, "Student 398", "PDF Task 397")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")

	def test_lists_only_the_latest_submissions_up_to_the_limit(self):
		frappe.set_user(self.faculty_user)

		self.assertEqual([row.name for row in api.list_cohort_submissions(limit=1)], [self.later])
