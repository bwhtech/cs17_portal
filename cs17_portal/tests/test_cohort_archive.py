# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestCohortArchive(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C431TEST")
		cls.archived_cohort = make_cohort("C432TEST")
		frappe.db.set_value("CS17 Cohort", cls.archived_cohort, "disabled", 1)

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")

	def test_cohort_list_leaves_out_archived_cohorts(self):
		user = make_user("faculty431@cs17test.com")
		make_profile("Faculty", None, user, "Faculty 431")
		frappe.set_user(user)

		cohorts = api.get_cohorts()

		self.assertIn(self.cohort, cohorts)
		self.assertNotIn(self.archived_cohort, cohorts)

	def test_faculty_of_an_archived_cohort_keeps_it(self):
		user = make_user("faculty432@cs17test.com")
		make_profile("Faculty", self.archived_cohort, user, "Faculty 432")
		frappe.set_user(user)

		self.assertEqual(api.get_cohorts(), [self.archived_cohort])
