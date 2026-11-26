# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime, today

from cs17_portal import activity_calendar, api, live_lab
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestActivityCalendar(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C660TEST")
		cls.faculty_user = make_user("faculty660@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student660@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.second_student = make_profile(
			"Student", cls.cohort, make_user("student661@cs17test.com"), "Diya Patel"
		)
		cls.other_faculty_user = make_user("faculty661@cs17test.com")
		make_profile("Faculty", make_cohort("C661TEST"), cls.other_faculty_user, "Rohan Mehta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Loops practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)

	def test_counts_saves_and_runs_by_day(self):
		frappe.set_user(self.student_user)
		project = api.start_python_assignment(self.assignment)["name"]
		api.save_python_project(project, "print('hello')")
		live_lab.record_code_run(project, passed=1, total=2)

		frappe.set_user(self.faculty_user)
		days = activity_calendar.get_student_activity_calendar(self.student)["days"]

		self.assertEqual(days, [{"date": today(), "saves": 1, "runs": 1, "submissions": 0}])

	def test_leaves_out_work_before_the_twelve_weeks(self):
		frappe.get_doc(
			{
				"doctype": "CS17 Code Run",
				"assignment": self.assignment,
				"student": self.second_student,
				"ran_at": add_to_date(now_datetime(), days=-84),
			}
		).insert(ignore_permissions=True)

		self.assertEqual(activity_calendar.get_student_activity_calendar(self.second_student)["days"], [])

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(
			frappe.PermissionError, activity_calendar.get_student_activity_calendar, self.student
		)
