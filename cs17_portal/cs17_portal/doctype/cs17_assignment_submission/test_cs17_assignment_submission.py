# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	validate_submission_value,
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

	def test_url_requires_valid_http_url(self):
		validate_submission_value("URL", "https://github.com/student/work")
		self._assert_rejected("URL", "https://")  # no host
		self._assert_rejected("URL", "ftp://example.com/work")
		self._assert_rejected("URL", "/files/work.pdf")
