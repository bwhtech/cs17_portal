# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from cs17_portal import api
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user

GREETING = 'print(f"Hello, {input()}!")\n'


class TestAssignmentTimeLimit(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C210TEST")
		cls.faculty_user = make_user("faculty210@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 210")
		cls.student_user = make_user("student210@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Student 210")

	def tearDown(self):
		frappe.set_user("Administrator")

	def make_timed_assignment(self, due_date: str = "2030-01-01 00:00:00") -> str:
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"Greet a Friend 210",
			self.cohort,
			due_date,
			submission_type="Python",
			description="Print a greeting for the name you read.",
			publish="now",
			test_cases=frappe.as_json(
				[{"input": "Asha\n", "expected_output": "Hello, Asha!\n", "is_hidden": 0}]
			),
			time_limit=30,
		)
		frappe.set_user(self.student_user)
		return assignment

	def start_minutes_ago(self, assignment: str, minutes: float) -> None:
		frappe.db.set_value(
			"CS17 Assignment Attempt",
			{"assignment": assignment, "student": self.student},
			"started_at",
			add_to_date(now_datetime(), minutes=-minutes),
		)

	def test_problem_is_withheld_until_the_student_starts(self):
		details = api.get_student_assignment(self.make_timed_assignment())

		self.assertIsNone(details.description)
		self.assertNotIn("sample_tests", details)

	def test_started_assignment_shows_the_problem(self):
		assignment = self.make_timed_assignment()
		api.start_python_assignment(assignment)

		details = api.get_student_assignment(assignment)

		self.assertEqual(details.description, "Print a greeting for the name you read.")

	def test_time_runs_out_the_limit_after_the_start(self):
		assignment = self.make_timed_assignment()
		api.start_python_assignment(assignment)

		details = api.get_student_assignment(assignment)

		self.assertEqual(details.ends_at, add_to_date(details.started_at, minutes=30))

	def test_time_runs_out_at_the_due_date_when_that_comes_first(self):
		assignment = self.make_timed_assignment(due_date=str(add_to_date(now_datetime(), minutes=10)))
		api.start_python_assignment(assignment)

		details = api.get_student_assignment(assignment)

		self.assertEqual(details.ends_at, frappe.db.get_value("CS17 Assignment", assignment, "due_date"))

	def test_reopening_the_editor_keeps_the_clock_running(self):
		assignment = self.make_timed_assignment()
		api.start_python_assignment(assignment)
		self.start_minutes_ago(assignment, 10)
		started_at = api.get_student_assignment(assignment).started_at

		api.start_python_assignment(assignment)

		self.assertEqual(api.get_student_assignment(assignment).started_at, started_at)

	def test_raising_the_time_limit_moves_the_end_of_a_started_attempt(self):
		assignment = self.make_timed_assignment()
		api.start_python_assignment(assignment)
		frappe.set_user(self.faculty_user)

		api.set_assignment_timing(assignment, "2030-01-01 00:00:00", 45)

		frappe.set_user(self.student_user)
		details = api.get_student_assignment(assignment)
		self.assertEqual(details.ends_at, add_to_date(details.started_at, minutes=45))

	def test_a_student_cannot_change_the_timing(self):
		assignment = self.make_timed_assignment()

		self.assertRaises(
			frappe.PermissionError, api.set_assignment_timing, assignment, "2030-01-01 00:00:00", 45
		)

	def test_assignment_closes_when_time_is_up(self):
		assignment = self.make_timed_assignment()
		api.start_python_assignment(assignment)
		self.start_minutes_ago(assignment, 31)

		self.assertTrue(api.is_assignment_closed(assignment))

	def test_submit_after_time_is_up_is_refused(self):
		assignment = self.make_timed_assignment()
		project = api.start_python_assignment(assignment)["name"]
		api.save_python_project(project, GREETING)
		self.start_minutes_ago(assignment, 31)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Your time for this assignment is up.",
			api.submit_python_project,
			assignment,
			project,
		)

	def test_submit_at_zero_is_accepted(self):
		assignment = self.make_timed_assignment()
		project = api.start_python_assignment(assignment)["name"]
		api.save_python_project(project, GREETING)
		self.start_minutes_ago(assignment, 30.25)

		self.assertTrue(api.submit_python_project(assignment, project)["name"])

	def test_submit_at_zero_is_accepted_when_the_due_date_ends_the_time(self):
		assignment = self.make_timed_assignment(due_date=str(add_to_date(now_datetime(), seconds=-10)))
		project = api.start_python_assignment(assignment)["name"]
		api.save_python_project(project, GREETING)

		self.assertTrue(api.submit_python_project(assignment, project)["name"])

	def test_negative_time_limit_is_refused(self):
		frappe.set_user(self.faculty_user)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"The time limit cannot be negative.",
			api.create_assignment,
			"Greet a Friend 211",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			time_limit=-5,
		)

	def test_time_limit_is_dropped_when_the_assignment_is_not_python(self):
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"PDF Task 212", self.cohort, "2030-01-01 00:00:00", submission_type="PDF", time_limit=30
		)

		self.assertEqual(frappe.db.get_value("CS17 Assignment", assignment, "time_limit"), 0)

	def test_deleting_the_assignment_deletes_its_attempts(self):
		assignment = self.make_timed_assignment()
		api.start_python_assignment(assignment)

		frappe.set_user(self.faculty_user)
		api.delete_assignment(assignment)

		self.assertFalse(frappe.db.exists("CS17 Assignment Attempt", {"assignment": assignment}))

	def test_faculty_sees_when_the_student_started(self):
		assignment = self.make_timed_assignment()
		project = api.start_python_assignment(assignment)["name"]
		started_at = api.get_student_assignment(assignment).started_at
		api.save_python_project(project, GREETING)
		submission = api.submit_python_project(assignment, project)["name"]

		frappe.set_user(self.faculty_user)

		self.assertEqual(api.get_assignment_attempt(submission)["started_at"], started_at)
