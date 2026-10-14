# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import base64

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user
from cs17_portal.tests.test_submission_archive import make_zip


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

	def test_submit_scratch_project_reports_a_project_file_gone_from_disk(self):
		cohort = make_cohort("C176TEST")
		faculty_user = make_user("faculty176@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 176")
		student_user = make_user("student176@cs17test.com")
		frappe.get_doc("User", student_user).add_roles("CS17 Student")
		make_profile("Student", cohort, student_user, "Student 176")

		frappe.set_user(faculty_user)
		assignment = make_assignment(cohort, "Scratch Task 176", "Scratch", 20)

		frappe.set_user(student_user)
		project = api.create_project("Student 176 Project")["name"]
		api.save_project(project, "project.sb3", base64.b64encode(make_zip({"project.json": b"v1"})).decode())
		frappe.db.set_value("File", {"attached_to_name": project}, "file_url", "/private/files/gone.sb3")
		frappe.db.set_value("CS17 Project", project, "sb3_file", "/private/files/gone.sb3")

		self.assertRaisesRegex(
			frappe.DoesNotExistError,
			"This submission's project file is missing.",
			api.submit_scratch_project,
			assignment,
			project,
		)
