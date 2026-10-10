# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import (
	make_assignment,
	make_cohort,
	make_profile,
	make_submission,
	make_user,
)

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class IntegrationTestCS17AssignmentGrade(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cohort = make_cohort("C85TEST")
		cls.faculty_user = make_user("faculty85@cs17test.com")
		make_profile("Faculty", cohort, cls.faculty_user, "Faculty 85")
		cls.second_faculty_user = make_user("faculty86@cs17test.com")
		make_profile("Faculty", cohort, cls.second_faculty_user, "Faculty 86")
		student = make_profile("Student", cohort, make_user("student85@cs17test.com"), "Student 85")

		frappe.set_user(cls.faculty_user)
		cls.assignment = make_assignment(cohort, "PDF Task 85", "PDF", 20)
		frappe.set_user("Administrator")

		cls.submission = make_submission(cls.assignment, student, "Student 85", "PDF Task 85")

	def setUp(self):
		super().setUp()
		frappe.set_user(self.faculty_user)
		self.grade = frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": self.assignment,
				"submission": self.submission,
				"marks_obtained": 15,
				"remarks": "Solid work",
			}
		).insert(ignore_permissions=True)
		frappe.set_user("Administrator")

	def test_grade_submission_without_grading_change_keeps_graded_by(self):
		with self.set_user(self.faculty_user):
			api.grade_submission(self.submission, grade="B")
		with self.set_user(self.second_faculty_user):
			grade = api.grade_submission(self.submission, grade="B", publish="now")["name"]

		self.assertEqual(frappe.db.get_value("CS17 Assignment Grade", grade, "graded_by"), self.faculty_user)

	def test_save_grade_without_grading_change_keeps_graded_by(self):
		with self.set_user(self.faculty_user):
			api.save_grade(self.submission, grade="B")
		with self.set_user(self.second_faculty_user):
			grade = api.save_grade(self.submission, grade="B")

		self.assertEqual(grade["graded_by"], self.faculty_user)

	def test_save_without_grading_change_keeps_graded_by(self):
		self.grade.is_published = 1
		self.grade.save()

		self.assertEqual(self.grade.graded_by, self.faculty_user)

	def test_changing_marks_updates_graded_by(self):
		self.grade.marks_obtained = 18
		self.grade.save()

		self.assertEqual(self.grade.graded_by, "Administrator")


class TestGradeFromMarks(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.assignment = make_assignment(make_cohort("C87TEST"), "PDF Task 87", "PDF", 20)
		frappe.db.set_value("CS17 Assignment", cls.assignment, "remarks", "Marks")
		cls.scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Grading Scale 87",
					"is_default": 1,
					"bands": [
						{"grade": "E", "min_percent": 0, "max_percent": 39.99},
						{"grade": "D", "min_percent": 40, "max_percent": 54.99},
						{"grade": "C", "min_percent": 55, "max_percent": 69.99},
						{"grade": "B", "min_percent": 70, "max_percent": 84.99},
						{"grade": "A", "min_percent": 85, "max_percent": 100},
					],
				}
			)
			.insert()
			.name
		)

	def test_marks_grade_takes_letter_from_default_scale(self):
		grade = frappe.get_doc(
			{"doctype": "CS17 Assignment Grade", "assignment": self.assignment, "marks_obtained": 15}
		).insert()

		self.assertEqual(grade.grade, "B")

	def test_marks_grade_is_empty_without_default_scale(self):
		frappe.db.set_value("CS17 Grading Scale", self.scale, "is_default", 0)
		self.addCleanup(frappe.db.set_value, "CS17 Grading Scale", self.scale, "is_default", 1)

		grade = frappe.get_doc(
			{"doctype": "CS17 Assignment Grade", "assignment": self.assignment, "marks_obtained": 15}
		).insert()

		self.assertIsNone(grade.grade)

	def test_patch_rewrites_wrong_letter(self):
		from cs17_portal.patches.v1_0.set_grade_for_marks_assignments import execute

		grade = frappe.get_doc(
			{"doctype": "CS17 Assignment Grade", "assignment": self.assignment, "marks_obtained": 15}
		).insert()
		frappe.db.set_value("CS17 Assignment Grade", grade.name, "grade", "A")

		execute()

		self.assertEqual(frappe.db.get_value("CS17 Assignment Grade", grade.name, "grade"), "B")
