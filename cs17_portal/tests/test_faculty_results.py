# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


def make_result(cohort: str, student: str, subject: str, scale: str) -> str:
	exam = frappe.get_doc(
		{
			"doctype": "CS17 Exam",
			"exam_name": f"Quarter Exam {cohort}",
			"cohort": cohort,
			"grading_scale": scale,
			"subjects": [{"subject": subject}],
		}
	).insert(ignore_permissions=True)
	return (
		frappe.get_doc({"doctype": "CS17 Result", "exam": exam.name, "student": student})
		.insert(ignore_permissions=True)
		.name
	)


class TestFacultyResults(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C411TEST")
		cls.other_cohort = make_cohort("C412TEST")
		cls.faculty_user = make_user("faculty411@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 411")
		cls.subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS411", "subject_name": "Maths 411"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		cls.scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 411",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		cls.student = make_profile("Student", cls.cohort, make_user("student411@cs17test.com"), "Student 411")
		other_student = make_profile(
			"Student", cls.other_cohort, make_user("student412@cs17test.com"), "Student 412"
		)
		cls.result = make_result(cls.cohort, cls.student, cls.subject, cls.scale)
		cls.other_result = make_result(cls.other_cohort, other_student, cls.subject, cls.scale)

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_list_holds_the_unpublished_results_of_the_faculty_cohort_only(self):
		results = api.get_faculty_results(cohort=self.other_cohort)

		self.assertEqual([row.name for row in results], [self.result])

	def test_result_of_the_faculty_cohort_opens(self):
		self.assertEqual(api.get_faculty_result(self.result)["name"], self.result)

	def test_result_of_another_cohort_is_refused(self):
		self.assertRaises(frappe.PermissionError, api.get_faculty_result, self.other_result)

	def test_result_lists_each_subject_part_with_its_section(self):
		pattern = frappe.get_doc(
			{
				"doctype": "CS17 Subject Pattern",
				"pattern_name": "Theory and Python 411",
				"components": [
					{"component": "Theory", "weightage": 70},
					{"component": "Python", "section": "Practical", "weightage": 30},
				],
			}
		).insert(ignore_permissions=True)
		exam = frappe.get_doc(
			{
				"doctype": "CS17 Exam",
				"exam_name": "Pattern Exam 411",
				"cohort": self.cohort,
				"grading_scale": self.scale,
				"subjects": [{"subject": self.subject, "subject_pattern": pattern.name}],
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "CS17 Subject Marks",
				"exam": exam.name,
				"student": self.student,
				"subject": self.subject,
				"components": [
					{"component": "Theory", "marks_obtained": 50},
					{"component": "Python", "marks_obtained": 20},
				],
			}
		).insert(ignore_permissions=True)
		result = frappe.get_doc({"doctype": "CS17 Result", "exam": exam.name, "student": self.student})
		result.insert(ignore_permissions=True)

		self.assertEqual(
			api.get_faculty_result(result.name)["scores"][0]["parts"],
			[
				{"component": "Theory", "section": None, "marks_obtained": 50, "max_marks": 70},
				{"component": "Python", "section": "Practical", "marks_obtained": 20, "max_marks": 30},
			],
		)
