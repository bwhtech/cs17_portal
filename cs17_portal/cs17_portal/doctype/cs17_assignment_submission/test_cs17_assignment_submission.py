# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	validate_submission_value,
)
from cs17_portal.tests.test_api import (
	make_assignment,
	make_cohort,
	make_profile,
	make_submission,
	make_user,
)


class TestDuplicateSubmission(FrappeTestCase):
	def test_second_submission_for_same_student_and_assignment_is_rejected(self):
		cohort = make_cohort("C29TEST")
		student = make_profile("Student", cohort, make_user("student29@cs17test.com"), "Student 29")
		faculty_user = make_user("faculty29@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 29")

		frappe.set_user(faculty_user)
		assignment = make_assignment(cohort, "PDF Task 29", "PDF", 20)
		frappe.set_user("Administrator")

		make_submission(assignment, student, "Student 29", "PDF Task 29")

		self.assertRaises(
			frappe.ValidationError, make_submission, assignment, student, "Student 29", "PDF Task 29"
		)


class TestSubmissionValueValidation(FrappeTestCase):
	def _assert_rejected(self, submission_type: str, file_url: str):
		self.assertRaises(frappe.ValidationError, validate_submission_value, submission_type, file_url)

	def test_any_accepts_anything(self):
		validate_submission_value("Any", "/files/anything.exe")
		validate_submission_value(None, "/files/anything.exe")

	def test_pdf_accepts_only_pdf(self):
		validate_submission_value("PDF", "/files/report.pdf")
		self._assert_rejected("PDF", "/files/report.png")

	def test_image_accepts_image_extensions_case_insensitive(self):
		validate_submission_value("Image", "/files/diagram.PNG")
		self._assert_rejected("Image", "/files/notes.pdf")

	def test_zip_accepts_archives(self):
		validate_submission_value("ZIP", "/files/code.tar.gz")
		self._assert_rejected("ZIP", "/files/code.pdf")

	def test_scratch_is_rejected(self):
		self._assert_rejected("Scratch", "/files/game.sb3")

	def test_url_requires_valid_http_url(self):
		validate_submission_value("URL", "https://github.com/student/work")
		self._assert_rejected("URL", "https://")  # no host
		self._assert_rejected("URL", "ftp://example.com/work")
		self._assert_rejected("URL", "/files/work.pdf")
