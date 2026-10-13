# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import base64

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestSubmissionFileApi(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_get_submission_project_returns_the_bytes_of_a_text_file(self):
		cohort = make_cohort("C175TEST")
		faculty_user = make_user("faculty175@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 175")
		student = make_profile("Student", cohort, make_user("student175@cs17test.com"), "Student 175")

		frappe.set_user(faculty_user)
		assignment = make_assignment(cohort, "Scratch Task 175", "Scratch", 20)
		frappe.set_user("Administrator")

		submission = make_submission(assignment, student, "Student 175", "Scratch Task 175")
		notes = api.attach_private_file(
			"CS17 Assignment Submission", submission, "submission_document", "notes.txt", b"ls -la\n"
		)
		frappe.db.set_value("CS17 Assignment Submission", submission, "submission_document", notes.file_url)

		frappe.set_user(faculty_user)
		result = api.get_submission_project(submission)

		self.assertEqual(base64.b64decode(result["content"]), b"ls -la\n")
