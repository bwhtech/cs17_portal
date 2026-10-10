# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

from cs17_portal.api import create_announcement, get_faculty_announcements, update_announcement
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class IntegrationTestCS17Announcement(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.faculty_user = make_user("faculty61@cs17test.com")
		make_profile("Faculty", make_cohort("C61TEST"), cls.faculty_user, "Faculty 61")

		frappe.set_user(cls.faculty_user)
		cls.announcement = create_announcement(
			"Lab moved to Friday", "Room 204", publish="schedule", publish_on="2000-01-01 00:00:00"
		)
		frappe.set_user("Administrator")

	def setUp(self):
		frappe.set_user(self.faculty_user)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_announcement_past_its_publish_time_cannot_be_edited(self):
		self.assertRaises(
			frappe.ValidationError, update_announcement, self.announcement, "Lab moved to Monday", "Room 204"
		)

	def test_announcement_past_its_publish_time_is_listed_as_published(self):
		row = next(row for row in get_faculty_announcements() if row.name == self.announcement)
		self.assertEqual(row.is_published, 1)
