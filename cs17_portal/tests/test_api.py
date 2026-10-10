# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.api import (
	get_recent_submissions,
	get_student_announcements,
	get_student_assignment,
	get_student_assignments,
	get_submission_grade,
	list_cohort_submissions,
)


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

	def test_get_recent_submissions_blocks_student(self):
		# Regression: get_recent_submissions must resolve the faculty from the session, not a caller-supplied
		# profile — a student passing their own profile once leaked their whole cohort's submissions.
		frappe.set_user(self.student_user)
		self.assertRaises(frappe.PermissionError, get_recent_submissions)

	def test_get_recent_submissions_scoped_to_own_cohort(self):
		frappe.set_user(self.faculty_27_user)
		self.assertEqual([row.name for row in get_recent_submissions()], [self.submission_27])

		frappe.set_user(self.faculty_28_user)
		names = [row.name for row in get_recent_submissions()]
		self.assertIn(self.submission_28, names)
		self.assertNotIn(self.submission_27, names)

	def test_get_submission_grade_prefill(self):
		frappe.set_user(self.faculty_27_user)
		grade = get_submission_grade(self.submission_27)

		self.assertEqual(grade.marks_obtained, 15)
		self.assertEqual(grade.grade, "B")
		self.assertEqual(grade.remarks, "Solid work")

	def test_get_submission_grade_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, get_submission_grade, self.submission_27)

	def test_faculty_reads_own_cohort_assignment(self):
		frappe.set_user(self.faculty_27_user)
		self.assertEqual(api.get_assignment(self.assignment_27).title, "Scratch Task 27")

	def test_get_assignment_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.get_assignment, self.assignment_27)

	def test_get_assignment_submissions_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.get_assignment_submissions, self.assignment_27)

	def test_grade_submission_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.grade_submission, self.submission_27, grade="A")

	def test_update_assignment_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(
			frappe.PermissionError,
			api.update_assignment,
			self.assignment_27,
			"Scratch Task 27",
			self.cohort_27,
			"2030-01-01 00:00:00",
		)

	def test_delete_assignment_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.delete_assignment, self.assignment_27)

	def test_publish_assignment_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.publish_assignment, self.assignment_27)

	def test_faculty_without_cohort_lists_every_cohort(self):
		make_profile("Faculty", None, make_user("faculty50@cs17test.com"), "Faculty 50")
		frappe.set_user("faculty50@cs17test.com")

		names = {row.name for row in list_cohort_submissions()}
		self.assertLessEqual({self.submission_27, self.submission_28}, names)

	def test_student_reads_own_cohort_assignment(self):
		frappe.set_user(self.student_user)
		self.assertEqual(get_student_assignment(self.assignment_27).title, "Scratch Task 27")

	def test_student_cannot_read_other_cohort_assignment(self):
		frappe.set_user(self.student_user)
		self.assertRaises(frappe.DoesNotExistError, get_student_assignment, self.assignment_28)


def make_announcement(title: str, cohort: str | None) -> str:
	return (
		frappe.get_doc(
			{
				"doctype": "CS17 Announcement",
				"title": title,
				"cohort": cohort,
				"is_published": 1,
			}
		)
		.insert(ignore_permissions=True)
		.name
	)


class TestStudentListsUseOwnCohort(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort_40 = make_cohort("C40TEST")
		cls.cohort_41 = make_cohort("C41TEST")

		cls.faculty_user = make_user("faculty40@cs17test.com")
		cls.student_user = make_user("student40@cs17test.com")
		cls.student_without_cohort_user = make_user("student42@cs17test.com")

		make_profile("Faculty", cls.cohort_40, cls.faculty_user, "Faculty 40")
		make_profile("Student", cls.cohort_40, cls.student_user, "Student 40")
		make_profile("Student", None, cls.student_without_cohort_user, "Student 42")

		frappe.set_user(cls.faculty_user)
		cls.assignment_40 = make_assignment(cls.cohort_40, "Scratch Task 40", "Scratch", 20)
		make_assignment(cls.cohort_41, "Scratch Task 41", "PDF", 50)
		frappe.set_user("Administrator")

		cls.announcement_40 = make_announcement("Announcement 40", cls.cohort_40)
		cls.announcement_41 = make_announcement("Announcement 41", cls.cohort_41)
		cls.announcement_for_all = make_announcement("Announcement for all cohorts", None)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_student_lists_only_own_cohort_assignments(self):
		frappe.set_user(self.student_user)
		names = [row.name for row in get_student_assignments()["assignments"]]
		self.assertEqual(names, [self.assignment_40])

	def test_student_lists_only_own_cohort_announcements(self):
		frappe.set_user(self.student_user)
		names = [row.name for row in get_student_announcements()["announcements"]]
		self.assertIn(self.announcement_40, names)
		self.assertNotIn(self.announcement_41, names)

	def test_student_without_cohort_lists_all_cohort_announcements(self):
		frappe.set_user(self.student_without_cohort_user)
		names = [row.name for row in get_student_announcements()["announcements"]]
		self.assertIn(self.announcement_for_all, names)
		self.assertNotIn(self.announcement_40, names)

	def test_faculty_cannot_list_student_assignments(self):
		frappe.set_user(self.faculty_user)
		self.assertRaises(frappe.PermissionError, get_student_assignments)

	def test_faculty_cannot_list_student_announcements(self):
		frappe.set_user(self.faculty_user)
		self.assertRaises(frappe.PermissionError, get_student_announcements)


class TestFacultyAnnouncementsUseOwnCohort(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort_100 = make_cohort("C100TEST")
		cls.cohort_101 = make_cohort("C101TEST")

		cls.faculty_user = make_user("faculty100@cs17test.com")
		make_profile("Faculty", cls.cohort_100, cls.faculty_user, "Faculty 100")

		cls.announcement_100 = make_announcement("Announcement 100", cls.cohort_100)
		cls.announcement_101 = make_announcement("Announcement 101", cls.cohort_101)
		cls.announcement_for_all = make_announcement("Announcement for all cohorts", None)

	def setUp(self):
		frappe.set_user(self.faculty_user)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_delete_announcement_blocks_other_cohort_faculty(self):
		self.assertRaises(frappe.PermissionError, api.delete_announcement, self.announcement_101)

	def test_delete_announcement_blocks_cohort_faculty_on_all_cohorts(self):
		self.assertRaises(frappe.PermissionError, api.delete_announcement, self.announcement_for_all)

	def test_update_announcement_blocks_moving_to_other_cohort(self):
		self.assertRaises(
			frappe.PermissionError,
			api.update_announcement,
			self.announcement_100,
			"Announcement 100",
			"",
			cohort=self.cohort_101,
		)

	def test_faculty_lists_own_cohort_and_all_cohort_announcements(self):
		names = [row.name for row in api.get_faculty_announcements()]
		self.assertIn(self.announcement_100, names)
		self.assertIn(self.announcement_for_all, names)
		self.assertNotIn(self.announcement_101, names)
