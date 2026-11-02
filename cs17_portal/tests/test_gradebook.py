# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import csv
import io

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.gradebook import download_gradebook
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


def read_csv() -> list:
	return list(csv.reader(io.StringIO(frappe.response.result)))


class TestGradebook(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C986TEST")
		cls.faculty_user = make_user("faculty986@cs17test.com")
		cls.other_faculty_user = make_user("faculty987@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Kavita Rao")
		make_profile("Faculty", make_cohort("C987TEST"), cls.other_faculty_user, "Rohan Mehta")
		aarav = make_profile("Student", cls.cohort, make_user("student986@cs17test.com"), "Aarav Sharma")
		make_profile("Student", cls.cohort, make_user("student987@cs17test.com"), "Meera Iyer")

		frappe.set_user(cls.faculty_user)
		assignments = {}
		for title, remarks, due_date, mark, publish in (
			("Loops practice", "Marks", "2026-01-10 00:00:00", 15, "now"),
			("Lists project", "Marks", "2026-01-12 00:00:00", 21, None),
			("Functions quiz", "Grade", "2030-01-01 00:00:00", "B", "now"),
		):
			assignments[title] = make_assignment(cls.cohort, title, "PDF", 30 if remarks == "Marks" else 0)
			frappe.db.set_value(
				"CS17 Assignment",
				assignments[title],
				{"assignment_type": "Graded", "remarks": remarks, "due_date": due_date},
			)
			submission = make_submission(assignments[title], aarav, "Aarav Sharma", title)
			if remarks == "Marks":
				api.grade_submission(submission, marks_obtained=mark, publish=publish)
			else:
				api.grade_submission(submission, grade=mark, publish=publish)
		api.set_assignment_students(assignments["Lists project"], [aarav])
		frappe.db.set_value(
			"CS17 Assignment",
			make_assignment(cls.cohort, "Recursion drill", "PDF", 10),
			{"assignment_type": "Graded", "remarks": "Marks", "is_published": 0},
		)
		frappe.db.set_value(
			"CS17 Assignment",
			make_assignment(cls.cohort, "Reading log", "PDF", 0),
			"assignment_type",
			"Not Graded",
		)
		frappe.set_user("Administrator")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_has_a_column_per_published_graded_assignment_by_due_date(self):
		download_gradebook(self.cohort)

		self.assertEqual(
			read_csv()[0],
			["Student", "Loops practice", "Lists project", "Functions quiz", "Average", "Grade"],
		)

	def test_shows_published_marks_and_grades_only(self):
		download_gradebook(self.cohort)

		self.assertEqual(read_csv()[1][:4], ["Aarav Sharma", "15.0", "", "B"])

	def test_marks_missing_only_past_due_work_given_to_the_student(self):
		download_gradebook(self.cohort)

		self.assertEqual(read_csv()[2][:4], ["Meera Iyer", "Missing", "", ""])

	def test_average_and_grade_match_the_summary(self):
		api.download_class_report(self.cohort)
		summary = {row[0]: row[-2:] for row in read_csv()[1:]}
		download_gradebook(self.cohort)

		self.assertEqual({row[0]: row[-2:] for row in read_csv()[1:]}, summary)

	def test_file_name_has_the_cohort_and_quarter(self):
		download_gradebook(self.cohort, "Quarter 986")

		self.assertEqual(frappe.response.doctype, "Marks C986TEST Quarter 986")

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, download_gradebook, self.cohort)
