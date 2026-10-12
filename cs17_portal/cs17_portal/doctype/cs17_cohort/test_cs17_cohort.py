# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class IntegrationTestCS17Cohort(IntegrationTestCase):
	def test_cohort_code_unusable_in_a_profile_name_is_refused(self):
		cohort = frappe.get_doc(
			{
				"doctype": "CS17 Cohort",
				"cohort_code": "TESTCOHORT (A)",
				"start_date": "2026-01-01",
			}
		)

		self.assertRaises(frappe.ValidationError, cohort.insert, ignore_permissions=True)
