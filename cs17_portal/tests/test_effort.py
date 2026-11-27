# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from cs17_portal import api, effort, live_lab
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestEffort(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C620TEST")
		cls.faculty_user = make_user("faculty620@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student620@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.other_faculty_user = make_user("faculty621@cs17test.com")
		make_profile("Faculty", make_cohort("C621TEST"), cls.other_faculty_user, "Rohan Mehta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Loops practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)
		frappe.set_user(self.student_user)
		self.project = api.start_python_assignment(self.assignment)["name"]

	def get_effort(self) -> frappe._dict:
		frappe.set_user(self.faculty_user)
		return effort.get_student_effort(self.student)[self.assignment]

	def add(self, doctype: str, **fields) -> None:
		frappe.get_doc(
			{"doctype": doctype, "assignment": self.assignment, "student": self.student, **fields}
		).insert(ignore_permissions=True)

	def test_counts_runs_up_to_the_first_full_pass(self):
		live_lab.record_code_run(self.project, passed=1, total=2)
		live_lab.record_code_run(self.project, passed=2, total=2)
		live_lab.record_code_run(self.project, passed=2, total=2)

		row = self.get_effort()

		self.assertEqual((row.runs, row.runs_to_pass), (3, 2))

	def test_counts_hints_and_pastes(self):
		self.add("CS17 Hint", asked_at=now_datetime())
		self.add("CS17 Paste", pasted_at=now_datetime())
		self.add("CS17 Paste", pasted_at=now_datetime())

		row = self.get_effort()

		self.assertEqual((row.hints, row.pastes), (1, 2))

	def test_time_runs_from_first_save_to_last_save(self):
		self.add("CS17 Code Snapshot", project=self.project, saved_at=add_to_date(now_datetime(), hours=-2))
		self.add("CS17 Code Snapshot", project=self.project, saved_at=now_datetime())

		self.assertAlmostEqual(self.get_effort().seconds, 7200, delta=60)

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, effort.get_student_effort, self.student)
