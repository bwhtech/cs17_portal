# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import notify_students
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	edit_submission,
	submit_assignment,
)
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_user


class TestSendBack(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C340TEST")
		cls.faculty_user = make_user("faculty340@cs17test.com")
		cls.student_user = make_user("student340@cs17test.com")
		cls.other_student_user = make_user("student341@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 340")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Student 340")
		make_profile("Student", cls.cohort, cls.other_student_user, "Student 341")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = make_assignment(self.cohort, "URL Task 340", "URL", 20)
		frappe.set_user(self.student_user)
		self.submission = submit_assignment(self.assignment, "https://example.com/first-try")["name"]
		frappe.set_user(self.faculty_user)
		api.grade_submission(self.submission, grade="C", publish="now")
		frappe.db.set_value("CS17 Assignment", self.assignment, "due_date", "2000-01-01 00:00:00")

	def test_sent_back_submission_can_be_resubmitted_past_the_due_date(self):
		api.send_back_submission(self.submission, "Add a link to the running app.")

		frappe.set_user(self.student_user)
		edit_submission(self.submission, "https://example.com/second-try")

		self.assertIsNone(frappe.db.get_value("CS17 Assignment Submission", self.submission, "returned_on"))

	def test_sent_back_assignment_is_open_to_the_student(self):
		api.send_back_submission(self.submission, "Add a link to the running app.")

		frappe.set_user(self.student_user)
		self.assertFalse(api.is_assignment_closed(self.assignment))

	def test_send_back_keeps_the_earlier_attempt_with_its_grade(self):
		api.send_back_submission(self.submission, "Add a link to the running app.")

		self.assertEqual(
			[
				(revision.reason, revision.submission_url, revision.grade)
				for revision in api.get_submission_revisions(self.submission)
			],
			[("Add a link to the running app.", "https://example.com/first-try", "C")],
		)

	def test_send_back_hides_the_published_grade(self):
		api.send_back_submission(self.submission, "Add a link to the running app.")

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment Grade", {"submission": self.submission}, "is_published"), 0
		)

	def test_sending_back_notifies_the_student(self):
		with patch.object(frappe, "enqueue") as enqueue:
			api.send_back_submission(self.submission, "Add a link to the running app.")

		enqueue.assert_called_once_with(
			notify_students,
			assignment=self.assignment,
			students=[self.student],
			subject="Returned: URL Task 340",
			enqueue_after_commit=True,
		)

	def test_send_back_needs_a_reason(self):
		self.assertRaises(frappe.ValidationError, api.send_back_submission, self.submission, " ")

	def test_submission_already_sent_back_cannot_be_sent_back_again(self):
		api.send_back_submission(self.submission, "Add a link to the running app.")

		self.assertRaises(
			frappe.ValidationError, api.send_back_submission, self.submission, "Add a screenshot too."
		)

	def test_another_student_cannot_read_the_earlier_attempts(self):
		api.send_back_submission(self.submission, "Add a link to the running app.")

		frappe.set_user(self.other_student_user)
		self.assertRaises(frappe.PermissionError, api.get_submission_revisions, self.submission)

	def test_earlier_file_stays_after_the_student_submits_a_new_one(self):
		assignment = make_assignment(self.cohort, "Notes Task 340", "Any", 20)
		frappe.set_user(self.student_user)
		first = frappe.get_doc(
			{"doctype": "File", "file_name": "notes-340.txt", "is_private": 1, "content": "notes 340"}
		).save(ignore_permissions=True)
		submission = submit_assignment(assignment, first.file_url)["name"]
		frappe.set_user(self.faculty_user)
		api.send_back_submission(submission, "Add the second page of notes.")

		frappe.set_user(self.student_user)
		second = frappe.get_doc(
			{"doctype": "File", "file_name": "notes-340-final.txt", "is_private": 1, "content": "final notes 340"}
		).save(ignore_permissions=True)
		edit_submission(submission, second.file_url)

		self.assertTrue(frappe.db.exists("File", first.name))
