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
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import get_quarter_assignments


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

	def test_get_submission_grade_reports_a_missing_submission(self):
		frappe.set_user(self.faculty_27_user)
		self.assertRaises(frappe.DoesNotExistError, get_submission_grade, "missing-submission")

	def test_faculty_reads_own_cohort_assignment(self):
		frappe.set_user(self.faculty_27_user)
		self.assertEqual(api.get_assignment(self.assignment_27).title, "Scratch Task 27")

	def test_get_assignment_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.get_assignment, self.assignment_27)

	def test_get_assignment_submissions_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.get_assignment_submissions, self.assignment_27)

	def test_get_assignment_submissions_reports_a_missing_assignment(self):
		make_profile("Faculty", None, make_user("faculty53@cs17test.com"), "Faculty 53")
		frappe.set_user("faculty53@cs17test.com")
		self.assertRaises(frappe.DoesNotExistError, api.get_assignment_submissions, "missing-assignment")

	def test_get_assignment_submissions_lists_students_who_have_not_submitted(self):
		absent = make_profile("Student", self.cohort_27, make_user("absent27@cs17test.com"), "Absent 27")
		frappe.set_user(self.faculty_27_user)

		not_submitted = api.get_assignment_submissions(self.assignment_27)["not_submitted"]

		self.assertEqual([row.student for row in not_submitted], [absent])

	def test_get_assignment_submissions_leaves_out_students_whose_user_is_disabled(self):
		make_profile("Student", self.cohort_27, make_user("left27@cs17test.com"), "Left 27")
		frappe.db.set_value("User", "left27@cs17test.com", "enabled", 0)
		frappe.set_user(self.faculty_27_user)

		not_submitted = api.get_assignment_submissions(self.assignment_27)["not_submitted"]

		self.assertEqual(not_submitted, [])

	def test_patch_gives_an_old_submission_its_submitted_time(self):
		from cs17_portal.patches.v1_0.set_submitted_at_on_old_submissions import execute

		frappe.db.set_value("CS17 Assignment Submission", self.submission_27, "submitted_at", None)
		self.addCleanup(
			frappe.db.set_value,
			"CS17 Assignment Submission",
			self.submission_27,
			"submitted_at",
			"2026-02-01 10:00:00",
		)

		execute()

		submitted_at, creation = frappe.db.get_value(
			"CS17 Assignment Submission", self.submission_27, ["submitted_at", "creation"]
		)
		self.assertEqual(submitted_at, creation)

	def test_publish_grades_publishes_the_draft_grade_of_a_submission(self):
		grade = frappe.db.get_value("CS17 Assignment Grade", {"submission": self.submission_27})
		frappe.db.set_value("CS17 Assignment Grade", grade, "is_published", 0)
		frappe.set_user(self.faculty_27_user)

		api.publish_grades([self.submission_27])

		self.assertEqual(frappe.db.get_value("CS17 Assignment Grade", grade, "is_published"), 1)

	def test_grade_submission_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.grade_submission, self.submission_27, grade="A")

	def test_grade_submission_stores_remarks_without_the_spaces_around_them(self):
		frappe.set_user(self.faculty_28_user)
		grade = api.grade_submission(self.submission_28, grade="B", remarks="Good work  ")["name"]
		self.addCleanup(frappe.delete_doc, "CS17 Assignment Grade", grade)

		self.assertEqual(frappe.db.get_value("CS17 Assignment Grade", grade, "remarks"), "Good work")

	def test_grade_submission_stores_empty_remarks_as_no_remarks(self):
		frappe.set_user(self.faculty_28_user)
		grade = api.grade_submission(self.submission_28, grade="B", remarks="")["name"]
		self.addCleanup(frappe.delete_doc, "CS17 Assignment Grade", grade)

		self.assertIsNone(frappe.db.get_value("CS17 Assignment Grade", grade, "remarks"))

	def test_grade_cannot_be_scheduled_for_a_time_that_has_passed(self):
		frappe.set_user(self.faculty_27_user)
		with self.assertRaises(frappe.ValidationError):
			api.grade_submission(
				self.submission_27, grade="B", publish="schedule", publish_on="2000-01-01 00:00:00"
			)

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

	def test_update_assignment_keeps_fields_the_caller_left_out(self):
		frappe.set_user(self.faculty_27_user)
		assignment = api.create_assignment(
			"Scratch Task 91",
			self.cohort_27,
			"2030-01-01 00:00:00",
			submission_type="Scratch",
			assignment_type="Graded",
			max_marks=50,
			remarks="Marks",
		)

		api.update_assignment(assignment, "Scratch Task 91", self.cohort_27, "2030-02-01 00:00:00")

		self.assertEqual(
			frappe.db.get_value(
				"CS17 Assignment", assignment, ["assignment_type", "max_marks", "remarks", "submission_type"]
			),
			("Graded", 50, "Marks", "Scratch"),
		)

	def test_update_assignment_keeps_the_schedule_the_caller_left_out(self):
		frappe.set_user(self.faculty_27_user)
		assignment = api.create_assignment(
			"Scratch Task 93",
			self.cohort_27,
			"2030-01-01 00:00:00",
			publish="schedule",
			publish_on="2031-03-01 09:00:00",
		)

		api.update_assignment(assignment, "Scratch Task 93", self.cohort_27, "2030-02-01 00:00:00")

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment", assignment, "publish_on"),
			frappe.utils.get_datetime("2031-03-01 09:00:00"),
		)

	def test_delete_assignment_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.delete_assignment, self.assignment_27)

	def test_publish_assignment_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.publish_assignment, self.assignment_27)

	def test_create_assignment_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(
			frappe.PermissionError,
			api.create_assignment,
			"Scratch Task 90",
			self.cohort_27,
			"2030-01-01 00:00:00",
		)

	def test_assignment_cannot_be_scheduled_for_a_time_that_has_passed(self):
		frappe.set_user(self.faculty_27_user)
		with self.assertRaises(frappe.ValidationError):
			api.create_assignment(
				"Scratch Task 92",
				self.cohort_27,
				"2030-01-01 00:00:00",
				publish="schedule",
				publish_on="2000-01-01 00:00:00",
			)

	def test_update_assignment_blocks_move_to_other_cohort(self):
		frappe.set_user(self.faculty_27_user)
		self.assertRaises(
			frappe.PermissionError,
			api.update_assignment,
			self.assignment_27,
			"Scratch Task 27",
			self.cohort_28,
			"2030-01-01 00:00:00",
		)

	def test_assign_submission_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(
			frappe.PermissionError, api.assign_submission, self.submission_27, self.faculty_28_user
		)

	def test_assign_submission_blocks_other_cohort_assignee(self):
		frappe.set_user(self.faculty_27_user)
		self.assertRaises(
			frappe.ValidationError, api.assign_submission, self.submission_27, self.faculty_28_user
		)
		self.assertRaises(
			frappe.ValidationError, api.assign_submissions, [self.submission_27], self.faculty_28_user
		)

	def test_assign_submission_allows_faculty_without_cohort(self):
		make_profile("Faculty", None, make_user("faculty51@cs17test.com"), "Faculty 51")
		frappe.set_user(self.faculty_27_user)
		api.assign_submission(self.submission_27, "faculty51@cs17test.com")

		frappe.set_user("faculty51@cs17test.com")
		self.assertEqual([row.name for row in api.get_assigned_submissions()], [self.submission_27])

	def test_get_faculty_members_leaves_out_other_cohort_faculty(self):
		make_profile("Faculty", None, make_user("faculty52@cs17test.com"), "Faculty 52")
		frappe.set_user(self.faculty_27_user)
		users = {member.user for member in api.get_faculty_members(self.cohort_27)}

		self.assertLessEqual({self.faculty_27_user, "faculty52@cs17test.com"}, users)
		self.assertNotIn(self.faculty_28_user, users)

	def test_get_faculty_members_returns_profile_picture(self):
		frappe.db.set_value(
			"CS17 Profile", {"user": self.faculty_27_user}, "profile_picture", "/files/faculty-27.png"
		)
		frappe.set_user(self.faculty_27_user)
		pictures = {member.user: member.profile_picture for member in api.get_faculty_members(self.cohort_27)}

		self.assertEqual(pictures[self.faculty_27_user], "/files/faculty-27.png")

	def test_assign_submission_blocks_student_assignee(self):
		frappe.set_user(self.faculty_27_user)
		self.assertRaises(
			frappe.ValidationError, api.assign_submission, self.submission_27, self.student_user
		)
		self.assertFalse(
			frappe.db.exists("DocShare", {"share_name": self.submission_27, "user": self.student_user})
		)

	def test_faculty_without_role_assigns_submission(self):
		frappe.set_user(self.faculty_27_user)
		api.assign_submission(self.submission_27, self.faculty_27_user)

		self.assertEqual([row.name for row in api.get_assigned_submissions()], [self.submission_27])

	def test_save_grade_hides_missing_submission_from_student(self):
		frappe.set_user(self.student_user)
		self.assertRaises(frappe.PermissionError, api.save_grade, "missing-submission")

	def test_save_grade_reports_a_missing_submission(self):
		frappe.set_user(self.faculty_27_user)
		self.assertRaises(frappe.DoesNotExistError, api.save_grade, "missing-submission")

	def test_save_grade_stores_remarks_without_the_spaces_around_them(self):
		frappe.set_user(self.faculty_28_user)
		grade = api.save_grade(self.submission_28, grade="B", remarks="Good work  ")
		self.addCleanup(frappe.delete_doc, "CS17 Assignment Grade", grade["name"])

		self.assertEqual(grade["remarks"], "Good work")

	def test_save_grade_stores_empty_remarks_as_no_remarks(self):
		frappe.set_user(self.faculty_28_user)
		grade = api.save_grade(self.submission_28, grade="B", remarks="")
		self.addCleanup(frappe.delete_doc, "CS17 Assignment Grade", grade["name"])

		self.assertIsNone(grade["remarks"])

	def test_save_grade_stores_no_marks_on_a_letter_graded_assignment(self):
		frappe.set_user(self.faculty_28_user)
		grade = api.save_grade(self.submission_28, marks_obtained=15, grade="B")
		self.addCleanup(frappe.delete_doc, "CS17 Assignment Grade", grade["name"])

		self.assertEqual(grade["marks_obtained"], 0)

	def test_faculty_lists_only_own_cohort_assignments(self):
		frappe.set_user(self.faculty_27_user)
		names = [row.name for row in api.get_faculty_assignments()]
		self.assertNotIn(self.assignment_28, names)

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

	def test_assigned_submission_summary_counts_past_the_limit(self):
		make_profile("Faculty", None, make_user("faculty54@cs17test.com"), "Faculty 54")
		frappe.set_user("faculty54@cs17test.com")
		api.assign_submissions([self.submission_27, self.submission_28], "faculty54@cs17test.com")

		summary = api.get_assigned_submission_summary(limit=1)

		self.assertEqual(len(summary["submissions"]), 1)
		self.assertEqual(summary["total"], 2)

	def test_assigned_submissions_limit_skips_a_newer_one_from_another_cohort(self):
		frappe.set_user(self.faculty_27_user)
		api.assign_submission(self.submission_27, self.faculty_27_user)
		api._assign_submission_to(self.submission_28, self.faculty_27_user)

		self.assertEqual([row.name for row in api.get_assigned_submissions(limit=1)], [self.submission_27])

	def test_get_submission_blocks_other_cohort_faculty(self):
		frappe.set_user(self.faculty_28_user)
		self.assertRaises(frappe.PermissionError, api.get_submission, self.submission_27)

	def test_get_submission_returns_the_row_with_its_file_and_grade(self):
		frappe.db.set_value(
			"CS17 Assignment Submission",
			self.submission_27,
			"submission_url",
			"https://scratch.mit.edu/projects/27",
		)
		self.addCleanup(
			frappe.db.set_value, "CS17 Assignment Submission", self.submission_27, "submission_url", None
		)
		frappe.set_user(self.faculty_27_user)

		row = api.get_submission(self.submission_27)

		self.assertEqual(
			(row.submission_url, row.max_marks, row.grade), ("https://scratch.mit.edu/projects/27", 20, "B")
		)


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

	def test_student_assignment_row_carries_own_submission(self):
		user = make_user("student43@cs17test.com")
		student = make_profile("Student", self.cohort_40, user, "Student 43")
		submission = make_submission(self.assignment_40, student, "Student 43", "Scratch Task 40")

		frappe.set_user(user)
		row = get_student_assignments()["assignments"][0]
		self.assertEqual(row.submission.name, submission)

	def test_student_does_not_list_draft_assignments(self):
		frappe.set_user(self.faculty_user)
		draft = make_assignment(self.cohort_40, "PDF Draft 40", "PDF", 20)
		frappe.db.set_value("CS17 Assignment", draft, "is_published", 0)

		frappe.set_user(self.student_user)
		names = [row.name for row in get_student_assignments()["assignments"]]
		self.assertNotIn(draft, names)

	def test_student_does_not_list_draft_grades(self):
		student = frappe.db.get_value("CS17 Profile", {"user": self.student_user})
		submission = make_submission(self.assignment_40, student, "Student 40", "Scratch Task 40")
		frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": self.assignment_40,
				"submission": submission,
				"is_published": 0,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(self.student_user)
		self.assertEqual(api.get_student_grades()["grades"], [])

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

	def test_student_role_has_no_direct_read(self):
		frappe.get_doc("User", self.student_user).add_roles("CS17 Student")
		for doctype in ("CS17 Assignment Grade", "CS17 Assignment", "CS17 Announcement", "CS17 Exam"):
			self.assertFalse(frappe.has_permission(doctype, "read", user=self.student_user))

	def test_student_role_cannot_share_a_submission(self):
		frappe.get_doc("User", self.student_user).add_roles("CS17 Student")
		self.assertFalse(frappe.has_permission("CS17 Assignment Submission", "share", user=self.student_user))

	def test_faculty_cannot_list_student_assignments(self):
		frappe.set_user(self.faculty_user)
		self.assertRaises(frappe.PermissionError, get_student_assignments)

	def test_cohort_faculty_lists_only_own_cohort(self):
		frappe.set_user(self.faculty_user)
		self.assertEqual(api.get_cohorts(), [self.cohort_40])

	def test_student_cannot_list_quarters(self):
		frappe.set_user(self.student_user)
		self.assertRaises(frappe.PermissionError, api.get_quarters)

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

	def test_faculty_can_edit_only_own_cohort_announcements(self):
		can_edit = {row.name: row.can_edit for row in api.get_faculty_announcements()}
		self.assertTrue(can_edit[self.announcement_100])
		self.assertFalse(can_edit[self.announcement_for_all])

	def test_announcement_past_its_publish_time_is_listed_with_that_date(self):
		announcement = api.create_announcement(
			"Announcement 100 scheduled",
			"",
			cohort=self.cohort_100,
			publish="schedule",
			publish_on=frappe.utils.add_days(frappe.utils.now(), 1),
		)
		frappe.db.set_value("CS17 Announcement", announcement, "publish_on", "2000-01-01 00:00:00")

		row = next(row for row in api.get_faculty_announcements() if row.name == announcement)
		self.assertEqual(row.published_date, frappe.utils.getdate("2000-01-01"))

	def test_announcement_cannot_be_scheduled_for_a_time_that_has_passed(self):
		with self.assertRaises(frappe.ValidationError):
			api.create_announcement(
				"Announcement 100 scheduled",
				"",
				cohort=self.cohort_100,
				publish="schedule",
				publish_on="2000-01-01 00:00:00",
			)


class TestAssignmentQuarter(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_assignment_created_with_quarter_is_listed_for_that_quarter(self):
		cohort = make_cohort("C105TEST")
		faculty_user = make_user("faculty105@cs17test.com")
		make_profile("Faculty", cohort, faculty_user, "Faculty 105")
		student = make_profile("Student", cohort, make_user("student105@cs17test.com"), "Student 105")
		quarter = (
			frappe.get_doc({"doctype": "CS17 Quarter", "quarter_name": "Quarter 105"})
			.insert(ignore_permissions=True)
			.name
		)

		frappe.set_user(faculty_user)
		assignment = api.create_assignment(
			"PDF Task 105", cohort, "2030-01-01 00:00:00", publish="now", quarter=quarter
		)

		self.assertEqual(
			[row.name for row in get_quarter_assignments(quarter, cohort, student)], [assignment]
		)


class TestUpdateMyProfile(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.faculty_user = make_user("faculty110@cs17test.com")
		cls.faculty = make_profile("Faculty", None, cls.faculty_user, "Faculty 110")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_faculty_saves_own_name(self):
		frappe.set_user(self.faculty_user)
		api.update_my_profile("Tejeshawari", "Mourya")

		self.assertEqual(frappe.db.get_value("CS17 Profile", self.faculty, "full_name"), "Tejeshawari Mourya")

	def test_empty_profile_picture_clears_the_saved_one(self):
		frappe.db.set_value("CS17 Profile", self.faculty, "profile_picture", "/files/faculty-110.png")

		frappe.set_user(self.faculty_user)
		api.update_my_profile("Faculty", "110", profile_picture="")

		self.assertIsNone(frappe.db.get_value("CS17 Profile", self.faculty, "profile_picture"))

	def test_profile_picture_must_be_the_callers_own_upload(self):
		frappe.set_user(make_user("faculty111@cs17test.com"))
		file = frappe.get_doc(
			{"doctype": "File", "file_name": "faculty-111.png", "is_private": 1, "content": "picture 111"}
		).save(ignore_permissions=True)

		frappe.set_user(self.faculty_user)
		self.assertRaises(
			frappe.ValidationError, api.update_my_profile, "Faculty", "110", profile_picture=file.file_url
		)

	def test_name_only_save_keeps_the_saved_profile_picture(self):
		frappe.db.set_value("CS17 Profile", self.faculty, "profile_picture", "/files/faculty-110.png")

		frappe.set_user(self.faculty_user)
		api.update_my_profile("Tejeshawari", "Mourya", profile_picture="/files/faculty-110.png")

		self.assertEqual(
			frappe.db.get_value("CS17 Profile", self.faculty, "profile_picture"), "/files/faculty-110.png"
		)

	def test_update_my_profile_blocks_student(self):
		make_profile("Student", None, make_user("student110@cs17test.com"), "Student 110")

		frappe.set_user("student110@cs17test.com")
		self.assertRaises(frappe.PermissionError, api.update_my_profile, "Student", "Renamed")

	def test_update_my_profile_refuses_an_empty_last_name(self):
		frappe.set_user(self.faculty_user)
		self.assertRaises(frappe.MandatoryError, api.update_my_profile, "Faculty", "")

	def test_refused_name_is_answered_in_the_forms_words(self):
		frappe.set_user(self.faculty_user)
		self.assertRaisesRegex(
			frappe.MandatoryError,
			"Add your last name",
			api.update_my_profile,
			"Faculty",
			"<script>alert(1)</script>",
		)

	def test_replacing_the_profile_picture_deletes_the_old_file(self):
		frappe.set_user(self.faculty_user)
		old = frappe.get_doc(
			{"doctype": "File", "file_name": "faculty-110.png", "is_private": 0, "content": "picture 110"}
		).save(ignore_permissions=True)
		api.update_my_profile("Faculty", "110", profile_picture=old.file_url)
		new = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "faculty-110-new.png",
				"is_private": 0,
				"content": "new picture 110",
			}
		).save(ignore_permissions=True)
		api.update_my_profile("Faculty", "110", profile_picture=new.file_url)

		self.assertFalse(frappe.db.exists("File", old.name))

	def test_clearing_the_profile_picture_deletes_its_file(self):
		frappe.set_user(self.faculty_user)
		file = frappe.get_doc(
			{"doctype": "File", "file_name": "faculty-110.png", "is_private": 0, "content": "picture 110"}
		).save(ignore_permissions=True)
		api.update_my_profile("Faculty", "110", profile_picture=file.file_url)
		api.update_my_profile("Faculty", "110", profile_picture="")

		self.assertFalse(frappe.db.exists("File", file.name))

	def test_same_profile_picture_uploaded_again_keeps_one_file(self):
		frappe.set_user(self.faculty_user)
		picture = {
			"doctype": "File",
			"file_name": "faculty-110.png",
			"is_private": 0,
			"content": "picture 110",
		}
		file = frappe.get_doc(picture).save(ignore_permissions=True)
		api.update_my_profile("Faculty", "110", profile_picture=file.file_url)
		again = frappe.get_doc(picture).save(ignore_permissions=True)
		api.update_my_profile("Faculty", "110", profile_picture=again.file_url)

		self.assertEqual(
			frappe.get_all("File", filters={"file_url": file.file_url}, pluck="name"), [file.name]
		)

	def test_omitted_profile_picture_keeps_the_saved_one(self):
		frappe.db.set_value("CS17 Profile", self.faculty, "profile_picture", "/files/faculty-110.png")

		frappe.set_user(self.faculty_user)
		api.update_my_profile("Tejeshawari", "Mourya")

		self.assertEqual(
			frappe.db.get_value("CS17 Profile", self.faculty, "profile_picture"), "/files/faculty-110.png"
		)


class TestSubmitFeedback(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.student_user = make_user("student120@cs17test.com")
		cls.faculty_user = make_user("faculty120@cs17test.com")
		make_profile("Student", None, cls.student_user, "Student 120")
		make_profile("Faculty", None, cls.faculty_user, "Faculty 120")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_student_feedback_is_saved_with_them_as_owner(self):
		frappe.set_user(self.student_user)
		api.submit_feedback("Food", "Dinner is served cold")

		self.assertTrue(
			frappe.db.exists(
				"CS17 Feedback",
				{"owner": self.student_user, "category": "Food", "description": "Dinner is served cold"},
			)
		)

	def test_faculty_is_refused(self):
		frappe.set_user(self.faculty_user)
		self.assertRaises(frappe.PermissionError, api.submit_feedback, "Stay", "Fan is broken")
