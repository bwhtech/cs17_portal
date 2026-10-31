# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import saved_remarks
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestSavedRemarks(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C547TEST")
		cls.faculty_user = make_user("faculty547@cs17test.com")
		cls.other_faculty_user = make_user("faculty548@cs17test.com")
		cls.student_user = make_user("student547@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 547")
		make_profile("Faculty", cls.cohort, cls.other_faculty_user, "Faculty 548")
		make_profile("Student", cls.cohort, cls.student_user, "Student 547")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_another_faculty_does_not_see_the_remark(self):
		saved_remarks.save_remark("Check the 0 case")

		frappe.set_user(self.other_faculty_user)

		self.assertEqual(saved_remarks.get_saved_remarks(), [])

	def test_saving_the_same_remark_twice_keeps_one(self):
		first = saved_remarks.save_remark("Use a loop instead of repeated ifs")

		self.assertEqual(saved_remarks.save_remark("Use a loop instead of repeated ifs"), first)

	def test_save_remark_refuses_empty_text(self):
		with self.assertRaises(frappe.ValidationError):
			saved_remarks.save_remark("  ")

	def test_student_cannot_read_saved_remarks(self):
		frappe.set_user(self.student_user)

		with self.assertRaises(frappe.PermissionError):
			saved_remarks.get_saved_remarks()

	def test_another_faculty_cannot_delete_the_remark(self):
		saved_remark = saved_remarks.save_remark("Name each variable after what it holds")

		frappe.set_user(self.other_faculty_user)

		with self.assertRaises(frappe.PermissionError):
			saved_remarks.delete_saved_remark(saved_remark)

	def test_faculty_deletes_their_remark(self):
		saved_remark = saved_remarks.save_remark("Print the result once, after the loop")

		saved_remarks.delete_saved_remark(saved_remark)

		self.assertFalse(frappe.db.exists("CS17 Saved Remark", saved_remark))
