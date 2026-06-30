# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

TEST_USER = "cs17-profile-test@example.com"


class TestCS17Profile(FrappeTestCase):
	def setUp(self):
		# User creation commits (welcome email), so it escapes test rollback —
		# create idempotently and clear any profiles left from a prior run.
		if not frappe.db.exists("User", TEST_USER):
			frappe.get_doc(
				{
					"doctype": "User",
					"email": TEST_USER,
					"first_name": "Profile Test",
					"send_welcome_email": 0,
				}
			).insert(ignore_permissions=True)
		for name in frappe.get_all("CS17 Profile", filters={"user": TEST_USER}, pluck="name"):
			frappe.delete_doc("CS17 Profile", name, force=True, ignore_permissions=True)

	def _make_profile(self, profile_type: str, user: str | None = None):
		return frappe.get_doc(
			{
				"doctype": "CS17 Profile",
				"profile_type": profile_type,
				"first_name": "Test",
				"last_name": profile_type,
				"user": user,
			}
		)

	def test_user_cannot_have_student_and_faculty_profile(self):
		self._make_profile("Student", TEST_USER).insert(ignore_permissions=True)

		faculty = self._make_profile("Faculty", TEST_USER)
		self.assertRaises(frappe.ValidationError, faculty.insert, ignore_permissions=True)

	def test_profile_without_user_is_allowed(self):
		self._make_profile("Student").insert(ignore_permissions=True)
		self._make_profile("Faculty").insert(ignore_permissions=True)
