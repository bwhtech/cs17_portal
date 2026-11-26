# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime, today

from cs17_portal import activity_week, api
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestActivityWeek(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C650TEST")
		cls.faculty_user = make_user("faculty650@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student650@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.second_student = make_profile(
			"Student", cls.cohort, make_user("student651@cs17test.com"), "Diya Patel"
		)
		cls.other_faculty_user = make_user("faculty651@cs17test.com")
		make_profile("Faculty", make_cohort("C651TEST"), cls.other_faculty_user, "Rohan Mehta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Loops practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)

	def get_week(self) -> dict:
		frappe.set_user(self.faculty_user)
		return activity_week.get_class_activity_week(self.cohort)

	def get_student(self, full_name: str) -> dict:
		[row] = [row for row in self.get_week()["students"] if row["full_name"] == full_name]
		return row

	def test_counts_what_a_student_did_today(self):
		frappe.set_user(self.student_user)
		project = api.start_python_assignment(self.assignment)["name"]
		api.save_python_project(project, "print('hello')")

		week = self.get_week()
		[row] = [row for row in week["students"] if row["full_name"] == "Aarav Sharma"]

		day = row["days"][week["days"].index(today())]

		self.assertEqual((day["worked"], day["submitted"]), (1, 0))

	def test_a_student_with_no_work_all_week_comes_first(self):
		frappe.set_user(self.student_user)
		api.start_python_assignment(self.assignment)

		students = self.get_week()["students"]

		self.assertEqual([row["full_name"] for row in students], ["Diya Patel", "Aarav Sharma"])

	def test_leaves_out_work_from_another_week(self):
		frappe.get_doc(
			{
				"doctype": "CS17 Code Run",
				"assignment": self.assignment,
				"student": self.second_student,
				"ran_at": add_to_date(now_datetime(), days=-7),
			}
		).insert(ignore_permissions=True)

		self.assertFalse(any(day["opened"] for day in self.get_student("Diya Patel")["days"]))

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, activity_week.get_class_activity_week, self.cohort)
