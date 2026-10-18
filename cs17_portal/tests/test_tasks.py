# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import get_datetime

from cs17_portal.tasks import auto_publish_announcements, auto_publish_assignments, auto_publish_grades
from cs17_portal.tests.test_api import make_assignment, make_cohort


class TestPublishJobs(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C200TEST")

	def test_assignment_due_now_is_published_and_one_due_later_is_not(self):
		due = make_assignment(self.cohort, "PDF Task 200", "PDF", 20)
		later = make_assignment(self.cohort, "PDF Task 201", "PDF", 20)
		frappe.db.set_value("CS17 Assignment", due, {"is_published": 0, "publish_on": "2000-01-01 00:00:00"})
		frappe.db.set_value(
			"CS17 Assignment", later, {"is_published": 0, "publish_on": "2100-01-01 00:00:00"}
		)

		auto_publish_assignments()

		self.assertEqual(
			[frappe.db.get_value("CS17 Assignment", name, "is_published") for name in (due, later)], [1, 0]
		)

	def test_grade_due_now_is_published_and_one_due_later_is_not(self):
		assignment = make_assignment(self.cohort, "PDF Task 202", "PDF", 20)
		due = frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": assignment,
				"published_on": "2000-01-01 00:00:00",
			}
		).insert(ignore_permissions=True)
		later = frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": assignment,
				"published_on": "2100-01-01 00:00:00",
			}
		).insert(ignore_permissions=True)

		auto_publish_grades()

		self.assertEqual(
			[
				frappe.db.get_value("CS17 Assignment Grade", grade.name, "is_published")
				for grade in (due, later)
			],
			[1, 0],
		)

	def test_assignment_published_on_schedule_gets_a_new_modified_time(self):
		assignment = make_assignment(self.cohort, "PDF Task 203", "PDF", 20)
		frappe.db.set_value(
			"CS17 Assignment",
			assignment,
			{"is_published": 0, "publish_on": "2000-01-01 00:00:00"},
			modified="2000-01-01 00:00:00",
		)

		auto_publish_assignments()

		self.assertGreater(
			frappe.db.get_value("CS17 Assignment", assignment, "modified"),
			get_datetime("2000-01-01 00:00:00"),
		)

	def test_announcement_failing_again_after_a_change_is_logged_again(self):
		announcement = frappe.get_doc(
			{
				"doctype": "CS17 Announcement",
				"title": "Lab moved to Friday",
				"content": "Room 204",
				"cohort": self.cohort,
			}
		).insert(ignore_permissions=True)
		log = frappe.get_doc(
			{
				"doctype": "Error Log",
				"method": "Scheduled announcement not published",
				"reference_doctype": "CS17 Announcement",
				"reference_name": announcement.name,
			}
		).insert(ignore_permissions=True)
		self.addCleanup(log.delete)
		frappe.db.set_value(
			"CS17 Announcement", announcement.name, {"title": "", "publish_on": "2000-01-01 00:00:00"}
		)

		with patch.object(frappe, "log_error") as log_error:
			auto_publish_announcements()

		log_error.assert_called_once_with(
			title="Scheduled announcement not published",
			reference_doctype="CS17 Announcement",
			reference_name=announcement.name,
		)
