# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, add_to_date, get_datetime, now_datetime, today

from cs17_portal import api, class_activity, live_lab
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestClassActivity(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C560TEST")
		cls.faculty_user = make_user("faculty560@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student560@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.second_student = make_profile(
			"Student", cls.cohort, make_user("student561@cs17test.com"), "Diya Patel"
		)
		cls.other_faculty_user = make_user("faculty561@cs17test.com")
		make_profile("Faculty", make_cohort("C561TEST"), cls.other_faculty_user, "Rohan Mehta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Loops practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)

	def get_student(self, full_name: str) -> dict:
		frappe.set_user(self.faculty_user)
		[row] = [
			row
			for row in class_activity.get_class_activity(self.cohort)["students"]
			if row["full_name"] == full_name
		]
		return row

	def test_counts_what_a_student_did_on_an_assignment_today(self):
		frappe.set_user(self.student_user)
		project = api.start_python_assignment(self.assignment)["name"]
		api.save_python_project(project, "print('hello')")
		live_lab.record_code_run(project, passed=1, total=2)

		[row] = [
			row
			for row in self.get_student("Aarav Sharma")["assignments"]
			if row.assignment == self.assignment
		]

		self.assertEqual((row.typed, row.runs, row.passed, row.total, row.submitted), (True, 1, 1, 2, False))

	def test_a_student_with_no_work_comes_first(self):
		frappe.set_user(self.student_user)
		api.start_python_assignment(self.assignment)

		frappe.set_user(self.faculty_user)
		students = class_activity.get_class_activity(self.cohort)["students"]

		self.assertEqual([row["full_name"] for row in students], ["Diya Patel", "Aarav Sharma"])

	def test_leaves_out_work_from_another_day(self):
		frappe.get_doc(
			{
				"doctype": "CS17 Code Run",
				"assignment": self.assignment,
				"student": self.second_student,
				"ran_at": add_to_date(now_datetime(), days=-1),
			}
		).insert(ignore_permissions=True)

		self.assertEqual(self.get_student("Diya Patel")["opened"], 0)

	def test_spans_the_first_and_last_work_on_an_assignment(self):
		for ran_at in ("09:15:00", "11:40:00"):
			frappe.get_doc(
				{
					"doctype": "CS17 Code Run",
					"assignment": self.assignment,
					"student": self.second_student,
					"ran_at": f"{today()} {ran_at}",
				}
			).insert(ignore_permissions=True)

		[row] = self.get_student("Diya Patel")["assignments"]

		self.assertEqual(
			(str(row.first_active_at), str(row.last_active_at)),
			(f"{today()} 09:15:00", f"{today()} 11:40:00"),
		)

	def test_finds_the_long_gaps_in_practice_hours(self):
		two_days_ago = add_days(today(), -2)
		for ran_at in ("09:15:00", "11:40:00"):
			frappe.get_doc(
				{
					"doctype": "CS17 Code Run",
					"assignment": self.assignment,
					"student": self.second_student,
					"ran_at": f"{two_days_ago} {ran_at}",
				}
			).insert(ignore_permissions=True)

		day = class_activity.get_student_day(self.second_student, two_days_ago)

		self.assertEqual(
			[(window["from"], window["to"]) for window in day["idle"]],
			[
				(get_datetime(f"{two_days_ago} 09:15:00"), get_datetime(f"{two_days_ago} 11:40:00")),
				(get_datetime(f"{two_days_ago} 11:40:00"), get_datetime(f"{two_days_ago} 21:00:00")),
			],
		)

	def test_lists_only_the_assignments_not_started(self):
		untouched = api.create_assignment(
			"Patterns practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)
		student = frappe.db.get_value("CS17 Profile", {"user": self.student_user})
		frappe.set_user(self.student_user)
		api.start_python_assignment(self.assignment)

		frappe.set_user(self.faculty_user)
		not_started = [row["assignment"] for row in class_activity.get_student_day(student)["not_started"]]

		self.assertIn(untouched, not_started)
		self.assertNotIn(self.assignment, not_started)

	def test_a_student_day_lists_the_assignments_worked_on(self):
		student = frappe.db.get_value("CS17 Profile", {"user": self.student_user})
		frappe.set_user(self.student_user)
		api.start_python_assignment(self.assignment)

		frappe.set_user(self.faculty_user)
		assignments = class_activity.get_student_day(student)["assignments"]

		self.assertEqual([row.assignment for row in assignments], [self.assignment])

	def test_refuses_a_student_day_to_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, class_activity.get_student_day, self.second_student)

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, class_activity.get_class_activity, self.cohort)
