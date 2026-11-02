# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.rubric import get_rubric
from cs17_portal.tests.test_api import make_cohort, make_profile, make_submission, make_user

RUBRIC = [{"criterion": "Logic", "marks": 5}, {"criterion": "Style", "marks": 15}]
SCORES = [{"criterion": "Logic", "marks": 4}, {"criterion": "Style", "marks": 12}]


class TestRubric(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C990TEST")
		cls.next_cohort = make_cohort("C991TEST")
		cls.faculty_user = make_user("faculty990@cs17test.com")
		make_profile("Faculty", None, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student990@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def make_assignment(self, remarks: str = "Marks") -> str:
		return api.create_assignment(
			"Loops practice",
			self.cohort,
			"2030-01-01 00:00:00",
			assignment_type="Graded",
			remarks=remarks,
			publish="now",
			rubric=RUBRIC,
		)

	def make_submission(self) -> str:
		return make_submission(self.make_assignment(), self.student, "Aarav Sharma", "Loops practice")

	def get_scores(self, submission: str) -> list:
		return frappe.get_all(
			"CS17 Rubric Score",
			filters={"parent": frappe.db.get_value("CS17 Assignment Grade", {"submission": submission})},
			fields=["criterion", "marks", "max_marks"],
			order_by="idx asc",
		)

	def test_max_marks_is_the_rubric_total(self):
		assignment = self.make_assignment()

		self.assertEqual(frappe.db.get_value("CS17 Assignment", assignment, "max_marks"), 20)

	def test_rubric_is_refused_on_a_grade_assignment(self):
		self.assertRaisesRegex(frappe.ValidationError, "graded with marks", self.make_assignment, "Grade")

	def test_save_grade_totals_the_criterion_marks(self):
		submission = self.make_submission()

		api.save_grade(submission, marks_obtained=1, rubric_scores=SCORES)

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment Grade", {"submission": submission}, "marks_obtained"), 16
		)
		self.assertEqual(
			self.get_scores(submission),
			[
				{"criterion": "Logic", "marks": 4, "max_marks": 5},
				{"criterion": "Style", "marks": 12, "max_marks": 15},
			],
		)

	def test_save_grade_refuses_marks_above_a_criterion_max(self):
		submission = self.make_submission()

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Marks for Logic must be between 0 and 5",
			api.save_grade,
			submission,
			rubric_scores=[{"criterion": "Logic", "marks": 6}, {"criterion": "Style", "marks": 12}],
		)

	def test_save_grade_refuses_a_total_without_criterion_marks(self):
		submission = self.make_submission()

		self.assertRaisesRegex(
			frappe.ValidationError, "Enter the marks", api.save_grade, submission, marks_obtained=16
		)

	def test_grade_submission_totals_the_criterion_marks(self):
		submission = self.make_submission()

		api.grade_submission(submission, marks_obtained=1, rubric_scores=SCORES)

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment Grade", {"submission": submission}, "marks_obtained"), 16
		)

	def test_ai_draft_leaves_the_criterion_marks_to_faculty(self):
		submission = self.make_submission()
		draft = {"marks_obtained": 18, "grade": None, "remarks": "The loop stops one step early."}

		with patch("cs17_portal.api._ai_grade_draft", return_value=draft):
			api.save_ai_grade_draft(submission, [])

		grade = frappe.db.get_value(
			"CS17 Assignment Grade", {"submission": submission}, ["marks_obtained", "remarks"], as_dict=True
		)
		self.assertEqual((grade.marks_obtained, grade.remarks), (0, draft["remarks"]))
		self.assertEqual(self.get_scores(submission), [])

	def test_publish_grades_refuses_a_draft_without_criterion_marks(self):
		submission = self.make_submission()
		api.grade_submission(submission, remarks="The loop stops one step early.", rubric_scores=[])

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Enter the rubric marks for Aarav Sharma before publishing",
			api.publish_grades,
			[submission],
		)

	def test_publish_grades_publishes_a_rubric_grade(self):
		submission = self.make_submission()
		api.grade_submission(submission, rubric_scores=SCORES)

		api.publish_grades([submission])

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment Grade", {"submission": submission}, "is_published"), 1
		)

	def test_student_sees_the_criterion_marks_of_a_published_grade(self):
		submission = self.make_submission()
		api.save_grade(submission, rubric_scores=SCORES)
		frappe.set_user(self.student_user)

		grades = api.get_student_grades()["grades"]

		grade = next(grade for grade in grades if grade.submission == submission)
		self.assertEqual(
			grade.rubric_scores,
			[
				{"criterion": "Logic", "marks": 4, "max_marks": 5},
				{"criterion": "Style", "marks": 12, "max_marks": 15},
			],
		)

	def test_copy_keeps_the_rubric(self):
		[copy] = api.copy_assignments([self.make_assignment()], self.next_cohort)

		self.assertEqual(get_rubric(copy), RUBRIC)
