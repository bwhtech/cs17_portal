# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, get_datetime, now_datetime

from cs17_portal import api
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	submit_assignment,
)
from cs17_portal.gradebook import download_gradebook
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user
from cs17_portal.tests.test_gradebook import read_csv


def from_now(**kwargs) -> str:
	return str(add_to_date(now_datetime(), **kwargs))


class TestLateWork(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C980TEST")
		cls.faculty_user = make_user("faculty980@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student980@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def make_assignment(self, due_date, late_until, submission_type="URL", **kwargs) -> str:
		assignment = api.create_assignment(
			"Loops practice",
			self.cohort,
			due_date,
			submission_type=submission_type,
			publish="now",
			late_until=late_until,
			**kwargs,
		)
		frappe.set_user(self.student_user)
		return assignment

	def test_late_work_needs_a_due_date(self):
		self.assertRaisesRegex(
			frappe.ValidationError,
			"Set a due date before accepting late work.",
			api.create_assignment,
			"Loops practice",
			self.cohort,
			"",
			late_until=from_now(days=1),
		)

	def test_late_work_must_end_after_the_due_date(self):
		self.assertRaisesRegex(
			frappe.ValidationError,
			"Late work must be accepted until a time after the due date.",
			api.create_assignment,
			"Loops practice",
			self.cohort,
			from_now(days=2),
			late_until=from_now(days=1),
		)

	def test_late_penalty_cannot_pass_100(self):
		self.assertRaisesRegex(
			frappe.ValidationError,
			"The late penalty must be between 0 and 100.",
			api.create_assignment,
			"Loops practice",
			self.cohort,
			from_now(days=1),
			late_until=from_now(days=2),
			late_penalty=120,
		)

	def test_no_late_work_clears_the_penalty(self):
		due_date = from_now(days=1)
		assignment = api.create_assignment(
			"Loops practice",
			self.cohort,
			due_date,
			late_until=from_now(days=2),
			late_penalty=10,
		)

		api.set_assignment_timing(assignment, due_date, 0, late_until="")

		self.assertEqual(frappe.db.get_value("CS17 Assignment", assignment, "late_penalty"), 0)

	def test_faculty_open_late_work_on_a_published_assignment(self):
		due_date = from_now(hours=-1)
		late_until = from_now(days=1)
		assignment = self.make_assignment(due_date, None)
		frappe.set_user(self.faculty_user)

		api.set_assignment_timing(assignment, due_date, 0, late_until=late_until, late_penalty=10)

		frappe.set_user(self.student_user)
		details = api.get_student_assignment(assignment)
		self.assertEqual((details.late_until, details.late_penalty), (get_datetime(late_until), 10))

	def test_assignment_stays_open_until_late_work_ends(self):
		assignment = self.make_assignment(from_now(hours=-1), from_now(days=1))

		self.assertFalse(api.is_assignment_closed(assignment))

	def test_submission_in_the_late_window_is_accepted(self):
		assignment = self.make_assignment(from_now(hours=-1), from_now(days=1))

		submit_assignment(assignment, "https://example.com/loops")

		self.assertTrue(frappe.db.exists("CS17 Assignment Submission", {"assignment": assignment}))

	def test_submission_after_late_work_ends_is_refused(self):
		assignment = self.make_assignment(from_now(days=-2), from_now(days=-1))

		self.assertRaisesRegex(
			frappe.ValidationError,
			"The deadline for this assignment has passed.",
			submit_assignment,
			assignment,
			"https://example.com/loops",
		)

	def test_timed_attempt_in_the_late_window_ends_when_late_work_ends(self):
		assignment = self.make_assignment(
			from_now(hours=-1),
			from_now(minutes=10),
			submission_type="Python",
			time_limit=30,
		)
		api.start_python_assignment(assignment)

		details = api.get_student_assignment(assignment)

		self.assertEqual(details.ends_at, frappe.db.get_value("CS17 Assignment", assignment, "late_until"))

	def test_timed_assignment_can_be_attempted_again_in_the_late_window(self):
		assignment = self.make_assignment(
			from_now(hours=-1),
			from_now(days=1),
			submission_type="Python",
			time_limit=30,
			attempts_allowed=2,
		)
		api.start_python_assignment(assignment)
		frappe.db.set_value(
			"CS17 Assignment Attempt",
			{"assignment": assignment, "student": self.student},
			"started_at",
			from_now(minutes=-31),
		)

		self.assertEqual(api.get_student_assignment(assignment).next_attempt, 2)


class TestLateWorkInReports(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C981TEST")
		cls.faculty_user = make_user("faculty981@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Kavita Rao")
		make_profile("Student", cls.cohort, make_user("student981@cs17test.com"), "Diya Menon")
		frappe.set_user(cls.faculty_user)
		api.create_assignment(
			"Loops practice",
			cls.cohort,
			from_now(days=-1),
			assignment_type="Graded",
			remarks="Marks",
			max_marks=10,
			publish="now",
			late_until=from_now(days=1),
		)
		frappe.set_user("Administrator")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_class_report_does_not_count_work_missing_while_late_work_is_taken(self):
		self.assertEqual(api.get_class_report(self.cohort)[0].missing, 0)

	def test_gradebook_does_not_mark_work_missing_while_late_work_is_taken(self):
		download_gradebook(self.cohort)

		self.assertEqual(read_csv()[1][:2], ["Diya Menon", ""])
