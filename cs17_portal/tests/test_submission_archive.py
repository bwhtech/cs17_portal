# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import io
import tarfile
import zipfile
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import submission_archive
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	submit_assignment,
)
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_user

FILES = {
	"terminal-assignment/notes.txt": b"ls -la\n",
	"terminal-assignment/logs/history.txt": b"cat README.txt\n",
}


def make_zip(files: dict[str, bytes]) -> bytes:
	buffer = io.BytesIO()
	with zipfile.ZipFile(buffer, "w") as archive:
		for path, content in files.items():
			archive.writestr(path, content)
	return buffer.getvalue()


def make_tar_gz(files: dict[str, bytes]) -> bytes:
	buffer = io.BytesIO()
	with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
		for path, content in files.items():
			member = tarfile.TarInfo(path)
			member.size = len(content)
			archive.addfile(member, io.BytesIO(content))
	return buffer.getvalue()


class TestSubmissionArchive(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_zip_files_are_listed_with_their_text(self):
		entries = submission_archive.read_archive(make_zip(FILES))

		self.assertEqual(
			[(entry["path"], entry["preview"], entry["content"]) for entry in entries],
			[
				("terminal-assignment/notes.txt", "text", "ls -la\n"),
				("terminal-assignment/logs/history.txt", "text", "cat README.txt\n"),
			],
		)

	def test_tar_gz_files_are_listed_with_their_text(self):
		entries = submission_archive.read_archive(make_tar_gz(FILES))

		self.assertEqual(entries[1]["path"], "terminal-assignment/logs/history.txt")
		self.assertEqual(entries[1]["content"], "cat README.txt\n")

	def test_binary_file_is_listed_without_a_preview(self):
		entries = submission_archive.read_archive(make_zip({"terminal-assignment/a.out": b"\x7fELF\x00"}))

		self.assertIsNone(entries[0]["preview"])
		self.assertEqual(entries[0]["size"], 5)

	def test_archive_with_too_many_files_is_refused(self):
		with patch.object(submission_archive, "MAX_ENTRIES", 1):
			self.assertRaises(frappe.ValidationError, submission_archive.read_archive, make_zip(FILES))

	def test_file_that_is_not_an_archive_is_refused(self):
		self.assertRaises(frappe.ValidationError, submission_archive.read_archive, b"cat README.txt\n")

	def test_identical_uploads_keep_their_own_file_names(self):
		cohort = make_cohort("C35TEST")
		faculty_user = make_user("faculty35@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 35")
		frappe.set_user(faculty_user)
		assignment = make_assignment(cohort, "Terminal Task 35", "ZIP", 20)

		submissions = {}
		for number in (35, 36):
			student_user = make_user(f"student{number}@cs17test.com")
			make_profile("Student", cohort, student_user, f"Student {number}")
			frappe.set_user(student_user)
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"terminal-{number}.zip",
					"is_private": 1,
					"content": make_zip(FILES),
				}
			).save(ignore_permissions=True)
			submissions[file.file_name] = submit_assignment(assignment, file.file_url)["name"]

		frappe.set_user(faculty_user)
		for file_name, submission in submissions.items():
			self.assertEqual(submission_archive.get_submission_archive(submission)["filename"], file_name)

	def test_submission_without_its_file_is_reported_missing(self):
		cohort = make_cohort("C45TEST")
		faculty_user = make_user("faculty45@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 45")
		frappe.set_user(faculty_user)
		assignment = make_assignment(cohort, "Terminal Task 45", "ZIP", 20)

		student_user = make_user("student45@cs17test.com")
		make_profile("Student", cohort, student_user, "Student 45")
		frappe.set_user(student_user)
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "terminal-45.zip",
				"is_private": 1,
				"content": make_zip(FILES),
			}
		).save(ignore_permissions=True)
		submission = submit_assignment(assignment, file.file_url)["name"]
		frappe.db.delete("File", {"attached_to_name": submission})

		frappe.set_user(faculty_user)
		self.assertRaisesRegex(
			frappe.DoesNotExistError,
			"This submission's file is missing.",
			submission_archive.get_submission_archive,
			submission,
		)

	def test_submission_that_does_not_exist_is_reported_missing(self):
		faculty_user = make_user("faculty46@cs17test.com")
		make_profile("Faculty", make_cohort("C46TEST"), faculty_user, "Faculty 46")
		frappe.set_user(faculty_user)

		self.assertRaises(
			frappe.DoesNotExistError, submission_archive.get_submission_archive, "missing-submission"
		)

	def test_student_cannot_read_a_submission_archive(self):
		cohort = make_cohort("C33TEST")
		student_user = make_user("student33@cs17test.com")
		student = make_profile("Student", cohort, student_user, "Student 33")
		frappe.set_user(student_user)

		self.assertRaises(frappe.PermissionError, submission_archive.get_submission_archive, student)
