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
