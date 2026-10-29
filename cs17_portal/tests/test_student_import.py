# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.core.doctype.user.user import User
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


def new_student(email: str, cohort: str) -> dict:
	return {"row": 2, "first_name": "Student", "last_name": "440", "email": email, "cohort": cohort}


class TestStudentImport(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C440TEST")
		cls.manager = make_user("manager440@cs17test.com")
		frappe.get_doc("User", cls.manager).add_roles("System Manager")

	def setUp(self):
		welcome_mail = patch.object(User, "send_welcome_mail_to_user")
		self.send_welcome_mail = welcome_mail.start()
		self.addCleanup(welcome_mail.stop)
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.manager)

	def test_add_students_makes_a_student_in_the_cohort(self):
		api.add_students([new_student("student440@cs17test.com", self.cohort)])

		profile = frappe.db.get_value(
			"CS17 Profile", {"user": "student440@cs17test.com"}, ["profile_type", "cohort"], as_dict=True
		)
		self.assertEqual((profile.profile_type, profile.cohort), ("Student", self.cohort))
		self.assertIn("CS17 Student", frappe.get_roles("student440@cs17test.com"))

	def test_add_students_sends_the_welcome_email(self):
		api.add_students([new_student("student441@cs17test.com", self.cohort)])

		self.send_welcome_mail.assert_called_once()

	def test_add_students_skips_an_email_that_already_has_a_user(self):
		make_user("student442@cs17test.com")

		[student] = api.add_students([new_student("student442@cs17test.com", self.cohort)])

		self.assertEqual(student["error"], "Already has a user. Add their profile in desk.")
		self.assertFalse(frappe.db.exists("CS17 Profile", {"user": "student442@cs17test.com"}))

	def test_add_students_skips_an_email_that_already_has_a_profile(self):
		make_profile("Student", self.cohort, make_user("student443@cs17test.com"), "Student 443")

		[student] = api.add_students([new_student("student443@cs17test.com", self.cohort)])

		self.assertEqual(student["error"], "Already has a profile.")

	def test_add_students_skips_an_email_on_more_than_one_row(self):
		students = api.add_students(
			[
				new_student("student444@cs17test.com", self.cohort),
				new_student("student444@cs17test.com", self.cohort),
			]
		)

		self.assertEqual(
			[student["error"] for student in students], ["This email is on more than one row."] * 2
		)

	def test_add_students_skips_a_cohort_that_does_not_exist(self):
		[student] = api.add_students([new_student("student445@cs17test.com", "C449TEST")])

		self.assertEqual(student["error"], "No cohort named C449TEST.")

	def test_add_students_skips_an_archived_cohort(self):
		cohort = make_cohort("C441TEST")
		frappe.db.set_value("CS17 Cohort", cohort, "disabled", 1)

		[student] = api.add_students([new_student("student451@cs17test.com", cohort)])

		self.assertEqual(student["error"], "C441TEST is archived.")

	def test_add_students_skips_an_email_that_is_not_valid(self):
		[student] = api.add_students([new_student("student446 cs17test.com", self.cohort)])

		self.assertEqual(student["error"], "Not a valid email.")

	def test_add_students_skips_a_row_with_an_empty_column(self):
		[student] = api.add_students(
			[{**new_student("student447@cs17test.com", self.cohort), "last_name": ""}]
		)

		self.assertEqual(student["error"], "Fill in all four columns.")

	def test_add_students_refuses_faculty_who_are_not_system_managers(self):
		faculty_user = make_user("faculty440@cs17test.com")
		make_profile("Faculty", None, faculty_user, "Faculty 440")
		frappe.set_user(faculty_user)

		self.assertRaises(
			frappe.PermissionError, api.add_students, [new_student("student448@cs17test.com", self.cohort)]
		)

	def test_read_students_file_reads_each_row_by_its_row_number(self):
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "students-440.csv",
				"is_private": 1,
				"content": "First name,Last name,Email,Cohort\n,,,\nStudent,449,Student449@cs17test.com,C440TEST\n",
			}
		).save(ignore_permissions=True)

		students = api.read_students_file(file.file_url)

		self.assertEqual(
			[(student["row"], student["email"], student["error"]) for student in students],
			[(3, "student449@cs17test.com", None)],
		)

	def test_read_students_file_leaves_no_file_behind(self):
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "students-441.csv",
				"is_private": 1,
				"content": "First name,Last name,Email,Cohort\n",
			}
		).save(ignore_permissions=True)

		api.read_students_file(file.file_url)

		self.assertFalse(frappe.db.exists("File", file.name))

	def test_read_students_file_refuses_a_file_without_the_header(self):
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "students-442.csv",
				"is_private": 1,
				"content": "Student,450,student450@cs17test.com,C440TEST\n",
			}
		).save(ignore_permissions=True)

		with patch.object(frappe, "enqueue"):
			self.assertRaisesRegex(
				frappe.ValidationError, "^The first row must be", api.read_students_file, file.file_url
			)
