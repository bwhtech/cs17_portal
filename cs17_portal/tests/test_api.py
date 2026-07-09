# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal.api import get_submission_grade, list_cohort_submissions


def make_user(email: str) -> str:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": email.split("@")[0],
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
	return email


def make_cohort(cohort_code: str) -> str:
	if not frappe.db.exists("CS17 Cohort", cohort_code):
		frappe.get_doc(
			{
				"doctype": "CS17 Cohort",
				"cohort_code": cohort_code,
				"start_date": "2026-01-01",
			}
		).insert(ignore_permissions=True)
	return cohort_code


def make_profile(profile_type: str, cohort: str, user: str, full_name: str) -> str:
	return (
		frappe.get_doc(
			{
				"doctype": "CS17 Profile",
				"profile_type": profile_type,
				"cohort": cohort,
				"user": user,
				"full_name": full_name,
				"first_name": full_name.split(" ")[0],
				"last_name": full_name.split(" ")[-1],
			}
		)
		.insert(ignore_permissions=True)
		.name
	)


def make_assignment(cohort: str, title: str, submission_type: str, max_marks: float) -> str:
	return (
		frappe.get_doc(
			{
				"doctype": "CS17 Assignment",
				"title": title,
				"cohort": cohort,
				"submission_type": submission_type,
				"max_marks": max_marks,
				"due_date": "2030-01-01 00:00:00",
				"is_published": 1,
			}
		)
		.insert(ignore_permissions=True)
		.name
	)


def make_submission(assignment: str, student: str, full_name: str, assignment_title: str) -> str:
	return (
		frappe.get_doc(
			{
				"doctype": "CS17 Assignment Submission",
				"assignment": assignment,
				"student": student,
				"full_name": full_name,
				"assignment_title": assignment_title,
				"submitted_at": "2026-02-01 10:00:00",
			}
		)
		.insert(ignore_permissions=True)
		.name
	)


class TestFacultyCohortSubmissions(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort_27 = make_cohort("C27TEST")
		cls.cohort_28 = make_cohort("C28TEST")

		cls.faculty_27_user = make_user("faculty27@cs17test.com")
		cls.faculty_28_user = make_user("faculty28@cs17test.com")
		cls.student_user = make_user("student27@cs17test.com")

		make_profile("Faculty", cls.cohort_27, cls.faculty_27_user, "Faculty 27")
		make_profile("Faculty", cls.cohort_28, cls.faculty_28_user, "Faculty 28")
		cls.student_27 = make_profile("Student", cls.cohort_27, cls.student_user, "Student 27")

		frappe.set_user(cls.faculty_27_user)
		cls.assignment_27 = make_assignment(cls.cohort_27, "Scratch Task 27", "Scratch", 20)
		cls.assignment_28 = make_assignment(cls.cohort_28, "Scratch Task 28", "PDF", 50)
		frappe.set_user("Administrator")

		cls.submission_27 = make_submission(
			cls.assignment_27, cls.student_27, "Student 27", "Scratch Task 27"
		)
		# A second cohort's submission that must never leak to faculty 27.
		student_28 = make_profile("Student", cls.cohort_28, make_user("student28@cs17test.com"), "Student 28")
		cls.submission_28 = make_submission(cls.assignment_28, student_28, "Student 28", "Scratch Task 28")

		frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": cls.assignment_27,
				"submission": cls.submission_27,
				"marks_obtained": 15,
				"grade": "B",
				"remarks": "Solid work",
				"is_published": 1,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_faculty_sees_own_cohort_with_meta_and_grade(self):
		frappe.set_user(self.faculty_27_user)
		rows = list_cohort_submissions()

		self.assertEqual([row.name for row in rows], [self.submission_27])
		row = rows[0]
		self.assertEqual(row.assignment_title, "Scratch Task 27")
		self.assertEqual(row.submission_type, "Scratch")
		self.assertEqual(row.max_marks, 20)
		self.assertEqual(row.marks_obtained, 15)
		self.assertEqual(row.grade, "B")
		self.assertTrue(row.graded)

	def test_faculty_isolated_to_own_cohort(self):
		frappe.set_user(self.faculty_28_user)
		rows = list_cohort_submissions()

		names = [row.name for row in rows]
		self.assertIn(self.submission_28, names)
		self.assertNotIn(self.submission_27, names)
		# Cohort 28 submission is ungraded.
		self.assertFalse(rows[0].graded)
		self.assertIsNone(rows[0].marks_obtained)

	def test_student_is_blocked(self):
		frappe.set_user(self.student_user)
		self.assertRaises(frappe.PermissionError, list_cohort_submissions)

	def test_get_submission_grade_prefill(self):
		frappe.set_user(self.faculty_27_user)
		grade = get_submission_grade(self.submission_27)

		self.assertEqual(grade.marks_obtained, 15)
		self.assertEqual(grade.grade, "B")
		self.assertEqual(grade.remarks, "Solid work")

	def test_get_submission_grade_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, get_submission_grade, self.submission_27)
