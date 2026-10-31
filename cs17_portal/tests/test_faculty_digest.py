# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import get_datetime

from cs17_portal import api
from cs17_portal.tasks import send_faculty_digest
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


def digest_sent_to(user: str) -> dict | None:
	with (
		patch("cs17_portal.tasks.now_datetime", return_value=get_datetime("2029-12-29 08:00:00")),
		patch.object(frappe, "sendmail") as sendmail,
	):
		send_faculty_digest()
	return next(
		(call.kwargs["args"] for call in sendmail.call_args_list if call.kwargs["recipients"] == [user]),
		None,
	)


class TestFacultyDigest(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C600TEST")
		cls.faculty_user = make_user("faculty600@cs17test.com")
		cls.idle_faculty_user = make_user("faculty601@cs17test.com")
		cls.faculty_without_cohort_user = make_user("faculty602@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		make_profile("Faculty", make_cohort("C601TEST"), cls.idle_faculty_user, "Rohan Gupta")
		make_profile("Faculty", None, cls.faculty_without_cohort_user, "Kavita Rao")
		cls.aarav = make_profile("Student", cls.cohort, make_user("student600@cs17test.com"), "Aarav Sharma")
		make_profile("Student", cls.cohort, make_user("student601@cs17test.com"), "Diya Patel")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_assignment_due_in_the_next_week_is_listed(self):
		assignment = make_assignment(self.cohort, "Loops practice", "PDF", 20)

		self.assertIn(assignment, [row.name for row in digest_sent_to(self.faculty_user)["due_soon"]])

	def test_assignment_due_last_week_counts_students_who_did_not_submit(self):
		assignment = make_assignment(self.cohort, "Lists practice", "PDF", 20)
		make_submission(assignment, self.aarav, "Aarav Sharma", "Lists practice")
		frappe.db.set_value("CS17 Assignment", assignment, "due_date", "2029-12-27 23:59:00")

		row = next(
			row for row in digest_sent_to(self.faculty_user)["not_submitted"] if row.name == assignment
		)

		self.assertEqual((row.not_submitted, row.given), (1, 2))

	def test_assignment_handed_to_some_students_counts_only_them(self):
		assignment = make_assignment(self.cohort, "Lists practice", "PDF", 20)
		api.set_assignment_students(assignment, [self.aarav])
		frappe.db.set_value("CS17 Assignment", assignment, "due_date", "2029-12-27 23:59:00")

		row = next(
			row for row in digest_sent_to(self.faculty_user)["not_submitted"] if row.name == assignment
		)

		self.assertEqual((row.not_submitted, row.given), (1, 1))

	def test_publishing_a_grade_takes_the_work_off_the_waiting_count(self):
		assignment = make_assignment(self.cohort, "Loops practice", "PDF", 20)
		submission = make_submission(assignment, self.aarav, "Aarav Sharma", "Loops practice")
		waiting = digest_sent_to(self.faculty_user)["waiting"]

		api.grade_submission(submission, grade="A", publish="now")

		self.assertEqual(digest_sent_to(self.faculty_user)["waiting"], waiting - 1)

	def test_sending_work_back_takes_it_off_the_waiting_count(self):
		assignment = make_assignment(self.cohort, "Loops practice", "PDF", 20)
		submission = make_submission(assignment, self.aarav, "Aarav Sharma", "Loops practice")
		waiting = digest_sent_to(self.faculty_user)["waiting"]

		api.send_back_submission(submission, "Handle the empty list too.")

		self.assertEqual(digest_sent_to(self.faculty_user)["waiting"], waiting - 1)

	def test_faculty_sees_only_their_cohort(self):
		make_assignment(self.cohort, "Loops practice", "PDF", 20)
		other_cohort = make_assignment(make_cohort("C602TEST"), "Strings practice", "PDF", 20)

		self.assertNotIn(other_cohort, [row.name for row in digest_sent_to(self.faculty_user)["due_soon"]])

	def test_faculty_without_a_cohort_sees_every_cohort(self):
		assignment = make_assignment(self.cohort, "Loops practice", "PDF", 20)

		self.assertIn(
			assignment, [row.name for row in digest_sent_to(self.faculty_without_cohort_user)["due_soon"]]
		)

	def test_faculty_with_nothing_to_report_is_not_emailed(self):
		self.assertIsNone(digest_sent_to(self.idle_faculty_user))

	def test_faculty_who_turned_email_off_is_not_emailed(self):
		make_assignment(self.cohort, "Loops practice", "PDF", 20)
		frappe.db.set_value("Notification Settings", self.faculty_user, "enable_email_notifications", 0)
		self.addCleanup(
			frappe.db.set_value, "Notification Settings", self.faculty_user, "enable_email_notifications", 1
		)

		self.assertIsNone(digest_sent_to(self.faculty_user))
