# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import csv
import io

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestClassReport(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C390TEST")
		cls.faculty_user = make_user("faculty390@cs17test.com")
		cls.other_faculty_user = make_user("faculty395@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 390")
		make_profile("Faculty", make_cohort("C395TEST"), cls.other_faculty_user, "Faculty 395")
		cls.student = make_profile("Student", cls.cohort, make_user("student390@cs17test.com"), "Student 390")
		cls.behind_student = make_profile(
			"Student", cls.cohort, make_user("student391@cs17test.com"), "Student 391"
		)

		frappe.set_user(cls.faculty_user)
		past_due = make_assignment(cls.cohort, "PDF Task 390", "PDF", 0)
		frappe.db.set_value("CS17 Assignment", past_due, "due_date", "2026-01-15 00:00:00")
		make_submission(past_due, cls.student, "Student 390", "PDF Task 390")
		given_to_one = make_assignment(cls.cohort, "PDF Task 391", "PDF", 0)
		api.set_assignment_students(given_to_one, [cls.student])
		make_submission(given_to_one, cls.student, "Student 390", "PDF Task 391")
		for title, max_marks, marks, publish in (
			("PDF Task 392", 20, 15, "now"),
			("PDF Task 393", 30, 21, "now"),
			("PDF Task 394", 50, 10, None),
		):
			assignment = make_assignment(cls.cohort, title, "PDF", max_marks)
			frappe.db.set_value(
				"CS17 Assignment", assignment, {"assignment_type": "Graded", "remarks": "Marks"}
			)
			submission = make_submission(assignment, cls.student, "Student 390", title)
			api.grade_submission(submission, marks_obtained=marks, publish=publish)
		frappe.set_user("Administrator")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_counts_what_each_student_was_given_submitted_missed_and_handed_in_late(self):
		self.assertEqual(
			{
				row.student: (row.given, row.submitted, row.missing, row.late)
				for row in api.get_class_report(self.cohort)
			},
			{self.student: (5, 5, 0, 1), self.behind_student: (4, 0, 1, 0)},
		)

	def test_average_is_published_marks_over_their_max_marks(self):
		self.assertEqual(
			{row.student: row.average for row in api.get_class_report(self.cohort)},
			{self.student: 72.0, self.behind_student: None},
		)

	def test_lists_students_with_missing_work_first(self):
		self.assertEqual(
			[row.student for row in api.get_class_report(self.cohort)], [self.behind_student, self.student]
		)

	def test_download_has_the_report_rows(self):
		api.download_class_report(self.cohort)

		self.assertEqual(
			list(csv.reader(io.StringIO(frappe.response.result)))[1],
			["Student 391", "4", "0", "1", "0", "", ""],
		)

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, api.get_class_report, self.cohort)
