# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import class_activity
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestActivityNudge(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C600TEST")
		cls.faculty_user = make_user("faculty600@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student600@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		other_cohort = make_cohort("C601TEST")
		cls.other_student = make_profile(
			"Student", other_cohort, make_user("student601@cs17test.com"), "Diya Patel"
		)
		cls.other_faculty_user = make_user("faculty601@cs17test.com")
		make_profile("Faculty", other_cohort, cls.other_faculty_user, "Rohan Mehta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_reminds_the_students_picked(self):
		with patch.object(frappe, "enqueue") as enqueue:
			class_activity.remind_students(self.cohort, [self.student])

		enqueue.assert_called_once_with(
			class_activity.send_reminder, students=[self.student], enqueue_after_commit=True
		)

	def test_reminder_reaches_the_student(self):
		with patch.object(frappe, "sendmail"):
			class_activity.send_reminder([self.student])

		self.assertTrue(
			frappe.db.exists(
				"Notification Log", {"for_user": self.student_user, "link": "/dashboard/assignments"}
			)
		)

	def test_refuses_a_student_of_another_cohort(self):
		with self.assertRaises(frappe.PermissionError):
			class_activity.remind_students(self.cohort, [self.other_student])

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		with self.assertRaises(frappe.PermissionError):
			class_activity.remind_students(self.cohort, [self.student])
