import frappe
from frappe.tests import IntegrationTestCase

from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class IntegrationTestCS17SubjectPattern(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cohort = make_cohort("C140TEST")
		student = make_profile("Student", cohort, make_user("student140@cs17test.com"), "Student 140")
		subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS140", "subject_name": "Maths 140"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 140",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		cls.pattern_with_marks, cls.pattern_without_marks = (
			frappe.get_doc(
				{
					"doctype": "CS17 Subject Pattern",
					"pattern_name": pattern_name,
					"components": [
						{"component": "Theory", "weightage": 40},
						{"component": "Practical", "weightage": 60},
					],
				}
			).insert(ignore_permissions=True)
			for pattern_name in ("Theory Practical 140", "Theory Practical 141")
		)
		exam = (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam",
					"exam_name": "Quarter Exam 140",
					"cohort": cohort,
					"grading_scale": scale,
					"subjects": [{"subject": subject, "subject_pattern": cls.pattern_with_marks.name}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		frappe.get_doc(
			{
				"doctype": "CS17 Subject Marks",
				"exam": exam,
				"student": student,
				"subject": subject,
				"components": [
					{"component": "Theory", "marks_obtained": 30},
					{"component": "Practical", "marks_obtained": 52},
				],
			}
		).insert(ignore_permissions=True)

	def test_components_cannot_change_once_marks_use_the_pattern(self):
		self.pattern_with_marks.components[0].weightage = 30
		self.pattern_with_marks.components[1].weightage = 70

		self.assertRaises(frappe.ValidationError, self.pattern_with_marks.save)

	def test_components_of_a_pattern_without_marks_can_change(self):
		self.pattern_without_marks.components[0].weightage = 30
		self.pattern_without_marks.components[1].weightage = 70
		self.pattern_without_marks.save()

		self.assertEqual(
			frappe.db.get_value(
				"CS17 Subject Pattern Component",
				{"parent": self.pattern_without_marks.name, "component": "Theory"},
				"weightage",
			),
			30,
		)
