# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, now_datetime

from cs17_portal.api import is_assignment_closed
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	edit_submission,
	submit_assignment,
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


class TestSubmissionOpenToStudent(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.student_user = make_user("student30@cs17test.com")
		make_profile("Student", make_cohort("C30TEST"), cls.student_user, "Student 30")
		cls.faculty_user = make_user("faculty30@cs17test.com")
		make_profile("Faculty", "C30TEST", cls.faculty_user, "Faculty 30")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_student_cannot_submit_to_another_cohorts_assignment(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(make_cohort("C31TEST"), "URL Task 31", "URL", 20)

		frappe.set_user(self.student_user)
		self.assertRaises(
			frappe.ValidationError, submit_assignment, assignment, "https://github.com/student/work"
		)

	def test_student_cannot_submit_to_an_unpublished_assignment(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment("C30TEST", "URL Task 30", "URL", 20)
		frappe.db.set_value("CS17 Assignment", assignment, "is_published", 0)

		frappe.set_user(self.student_user)
		self.assertRaises(
			frappe.ValidationError, submit_assignment, assignment, "https://github.com/student/work"
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


class TestSubmissionFileOwnership(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_student_cannot_submit_a_file_they_did_not_upload(self):
		cohort = make_cohort("C32TEST")
		student_user = make_user("student32@cs17test.com")
		make_profile("Student", cohort, student_user, "Student 32")
		faculty_user = make_user("faculty32@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 32")

		frappe.set_user(faculty_user)
		assignment = make_assignment(cohort, "PDF Task 32", "PDF", 20)

		frappe.set_user(student_user)
		self.assertRaises(frappe.ValidationError, submit_assignment, assignment, "/private/files/report.pdf")


class TestGradePastItsPublishTime(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cohort = make_cohort("C95TEST")
		cls.student_user = make_user("student95@cs17test.com")
		student = make_profile("Student", cohort, cls.student_user, "Student 95")
		faculty_user = make_user("faculty95@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 95")

		frappe.set_user(faculty_user)
		cls.assignment = make_assignment(cohort, "URL Task 95", "URL", 20)
		frappe.set_user("Administrator")

		cls.submission = make_submission(cls.assignment, student, "Student 95", "URL Task 95")
		frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": cls.assignment,
				"submission": cls.submission,
				"marks_obtained": 15,
				"is_published": 0,
				"published_on": add_days(now_datetime(), -1),
			}
		).insert(ignore_permissions=True)

	def setUp(self):
		frappe.set_user(self.student_user)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_student_cannot_resubmit(self):
		self.assertRaises(
			frappe.ValidationError, edit_submission, self.submission, "https://github.com/student/work"
		)

	def test_assignment_is_closed(self):
		self.assertTrue(is_assignment_closed(self.assignment))
