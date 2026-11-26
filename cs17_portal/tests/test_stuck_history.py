# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from cs17_portal import api, stuck_history
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestStuckHistory(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C670TEST")
		cls.faculty_user = make_user("faculty670@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student = make_profile(
			"Student", cls.cohort, make_user("student670@cs17test.com"), "Aarav Sharma"
		)
		cls.other_faculty_user = make_user("faculty671@cs17test.com")
		make_profile("Faculty", make_cohort("C671TEST"), cls.other_faculty_user, "Rohan Mehta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Loops practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)

	def add_run(self, minutes_ago: int, **result):
		frappe.get_doc(
			{
				"doctype": "CS17 Code Run",
				"assignment": self.assignment,
				"student": self.student,
				"ran_at": add_to_date(now_datetime(), minutes=-minutes_ago),
				**result,
			}
		).insert(ignore_permissions=True)

	def get_spells(self) -> list:
		return [
			spell
			for spell in stuck_history.get_student_stuck_history(self.student)
			if spell["assignment"] == self.assignment
		]

	def test_a_spell_closed_by_a_passing_run(self):
		self.add_run(60, error_type="NameError", error_line=3)
		self.add_run(57, error_type="NameError", error_line=3)
		self.add_run(53, passed=2, total=2)

		[spell] = self.get_spells()

		self.assertEqual(
			(spell["minutes"], spell["error_type"], spell["error_line"], spell["got_past"]),
			(7, "NameError", 3, True),
		)

	def test_leaves_out_a_failure_fixed_within_minutes(self):
		self.add_run(60, passed=1, total=2)
		self.add_run(58, passed=2, total=2)

		self.assertEqual(self.get_spells(), [])

	def test_a_break_ends_the_spell(self):
		self.add_run(120, passed=0, total=2)
		self.add_run(114, passed=0, total=2)
		self.add_run(60, passed=0, total=2)

		[spell] = self.get_spells()

		self.assertEqual((spell["minutes"], spell["got_past"]), (6, False))

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, stuck_history.get_student_stuck_history, self.student)
