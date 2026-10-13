# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from cs17_portal.api import (
	create_announcement,
	get_faculty_announcements,
	publish_announcement,
	update_announcement,
)
from cs17_portal.tasks import auto_publish_announcements
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
		cls.cohort = make_cohort("C61TEST")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 61")

		frappe.set_user(cls.faculty_user)
		cls.announcement = create_announcement(
			"Lab moved to Friday",
			"Room 204",
			cohort=cls.cohort,
			publish="schedule",
			publish_on=frappe.utils.add_days(frappe.utils.now(), 1),
		)
		frappe.db.set_value("CS17 Announcement", cls.announcement, "publish_on", "2000-01-01 00:00:00")
		frappe.set_user("Administrator")

	def setUp(self):
		frappe.set_user(self.faculty_user)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_announcement_past_its_publish_time_cannot_be_edited(self):
		self.assertRaises(
			frappe.ValidationError,
			update_announcement,
			self.announcement,
			"Lab moved to Monday",
			"Room 204",
			cohort=self.cohort,
		)

	def test_announcement_past_its_publish_time_cannot_be_published_again(self):
		self.assertRaises(frappe.ValidationError, publish_announcement, self.announcement)

	def test_published_announcement_cannot_be_scheduled(self):
		announcement = create_announcement(
			"Quiz moved to Monday", "Room 204", cohort=self.cohort, publish="now"
		)

		self.assertRaises(
			frappe.ValidationError,
			publish_announcement,
			announcement,
			publish="schedule",
			publish_on=frappe.utils.add_days(frappe.utils.now(), 1),
		)

	def test_announcement_past_its_publish_time_is_listed_as_published(self):
		row = next(row for row in get_faculty_announcements() if row.name == self.announcement)
		self.assertEqual(row.is_published, 1)

	def test_published_flag_sent_as_text_zero_sends_no_email(self):
		announcement = frappe.get_doc(
			{
				"doctype": "CS17 Announcement",
				"title": "Lab moved to Friday",
				"content": "Room 204",
				"cohort": self.cohort,
				"is_published": "0",
			}
		)

		with patch.object(announcement, "send_announcement_email") as send_announcement_email:
			announcement.insert(ignore_permissions=True)

		send_announcement_email.assert_not_called()

	def test_due_announcement_is_published_when_another_one_fails(self):
		failing = create_announcement(
			"Quiz moved to Monday",
			"Room 204",
			cohort=self.cohort,
			publish="schedule",
			publish_on=frappe.utils.add_days(frappe.utils.now(), 1),
		)
		frappe.db.set_value("CS17 Announcement", failing, {"title": "", "publish_on": "2000-01-01 00:00:00"})

		with patch.object(frappe, "log_error"):
			auto_publish_announcements()

		self.assertEqual(frappe.db.get_value("CS17 Announcement", self.announcement, "is_published"), 1)

	def test_announcement_published_on_schedule_keeps_its_date_and_drops_the_schedule(self):
		announcement = create_announcement(
			"Quiz moved to Monday",
			"Room 204",
			cohort=self.cohort,
			publish="schedule",
			publish_on=frappe.utils.add_days(frappe.utils.now(), 1),
		)
		frappe.db.set_value("CS17 Announcement", announcement, "publish_on", "2000-01-01 00:00:00")

		auto_publish_announcements()

		self.assertEqual(
			frappe.db.get_value("CS17 Announcement", announcement, ["published_date", "publish_on"]),
			(frappe.utils.getdate("2000-01-01"), None),
		)

	def test_unpublished_announcement_drops_a_publish_time_that_has_passed(self):
		announcement = create_announcement(
			"Quiz moved to Monday", "Room 204", cohort=self.cohort, publish="now"
		)
		frappe.db.set_value("CS17 Announcement", announcement, "publish_on", "2000-01-01 00:00:00")

		doc = frappe.get_doc("CS17 Announcement", announcement)
		doc.is_published = 0
		doc.save(ignore_permissions=True)

		self.assertIsNone(frappe.db.get_value("CS17 Announcement", announcement, "publish_on"))

	def test_scheduled_announcement_drops_an_old_published_date(self):
		announcement = create_announcement("Quiz moved to Monday", "Room 204", cohort=self.cohort)
		frappe.db.set_value("CS17 Announcement", announcement, "published_date", "2026-09-01")

		publish_announcement(
			announcement, publish="schedule", publish_on=frappe.utils.add_days(frappe.utils.now(), 1)
		)

		self.assertIsNone(frappe.db.get_value("CS17 Announcement", announcement, "published_date"))

	def test_announcement_published_in_desk_gets_todays_date(self):
		announcement = create_announcement("Quiz moved to Monday", "Room 204", cohort=self.cohort)

		doc = frappe.get_doc("CS17 Announcement", announcement)
		doc.is_published = 1
		doc.save(ignore_permissions=True)

		self.assertEqual(
			frappe.db.get_value("CS17 Announcement", announcement, "published_date"), frappe.utils.getdate()
		)

	def test_published_announcement_keeps_its_date_when_saved_again(self):
		announcement = create_announcement(
			"Quiz moved to Monday", "Room 204", cohort=self.cohort, publish="now"
		)
		frappe.db.set_value("CS17 Announcement", announcement, "published_date", "2026-09-01")

		frappe.get_doc("CS17 Announcement", announcement).save(ignore_permissions=True)

		self.assertEqual(
			frappe.db.get_value("CS17 Announcement", announcement, "published_date"),
			frappe.utils.getdate("2026-09-01"),
		)

	def test_unpublished_announcement_drops_its_published_date(self):
		announcement = create_announcement(
			"Quiz moved to Monday", "Room 204", cohort=self.cohort, publish="now"
		)

		doc = frappe.get_doc("CS17 Announcement", announcement)
		doc.is_published = 0
		doc.save(ignore_permissions=True)

		self.assertIsNone(frappe.db.get_value("CS17 Announcement", announcement, "published_date"))
