# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class IntegrationTestCS17PortalSettings(IntegrationTestCase):
	"""
	Integration tests for CS17PortalSettings.
	Use this class for testing interactions between multiple components.
	"""

	def test_refuses_practice_hours_that_end_before_they_start(self):
		settings = frappe.get_doc(
			{
				"doctype": "CS17 Portal Settings",
				"practice_hours_start": "21:00:00",
				"practice_hours_end": "09:00:00",
			}
		)

		self.assertRaises(frappe.ValidationError, settings.insert)
