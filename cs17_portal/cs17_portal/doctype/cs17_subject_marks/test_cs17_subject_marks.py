import frappe
from frappe.tests import IntegrationTestCase

from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class IntegrationTestCS17SubjectMarks(IntegrationTestCase):
	def test_full_marks_on_every_component_reach_the_result(self):
		cohort = make_cohort("C150TEST")
		student = make_profile("Student", cohort, make_user("student150@cs17test.com"), "Student 150")
		subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS150", "subject_name": "Maths 150"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 150",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		pattern = (
			frappe.get_doc(
				{
					"doctype": "CS17 Subject Pattern",
					"pattern_name": "Theory Practical Project 150",
					"components": [
						{"component": "Theory", "weightage": 33.33},
						{"component": "Practical", "weightage": 33.33},
						{"component": "Project", "weightage": 33.34},
					],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		exam = (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam",
					"exam_name": "Quarter Exam 150",
					"cohort": cohort,
					"grading_scale": scale,
					"subjects": [{"subject": subject, "max_marks": 999, "subject_pattern": pattern}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		marks = frappe.get_doc(
			{"doctype": "CS17 Subject Marks", "exam": exam, "student": student, "subject": subject}
		).insert(ignore_permissions=True)
		result = (
			frappe.get_doc({"doctype": "CS17 Result", "exam": exam, "student": student})
			.insert(ignore_permissions=True)
			.name
		)

		for row in marks.components:
			row.marks_obtained = row.max_marks
		marks.save()

		self.assertEqual(sum(row.max_marks for row in marks.components), 999)
		self.assertEqual(frappe.db.get_value("CS17 Result", result, "total_marks_obtained"), 999)

	def test_second_marks_for_the_same_exam_student_and_subject_are_refused(self):
		cohort = make_cohort("C151TEST")
		student = make_profile("Student", cohort, make_user("student151@cs17test.com"), "Student 151")
		subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS151", "subject_name": "Maths 151"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 151",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		exam = (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam",
					"exam_name": "Quarter Exam 151",
					"cohort": cohort,
					"grading_scale": scale,
					"subjects": [{"subject": subject, "max_marks": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		marks = {"doctype": "CS17 Subject Marks", "exam": exam, "student": student, "subject": subject}
		first = frappe.get_doc(marks).insert(ignore_permissions=True)

		self.assertRaisesRegex(
			frappe.ValidationError,
			f"Marks {first.name} already exist for this student and subject.",
			frappe.get_doc(marks).insert,
			ignore_permissions=True,
		)

	def test_exam_student_and_subject_have_a_unique_index(self):
		self.assertTrue(frappe.db.has_index("tabCS17 Subject Marks", "unique_exam_student_subject"))

	def test_marks_and_their_result_agree_on_pass_or_fail(self):
		cohort = make_cohort("C152TEST")
		student = make_profile("Student", cohort, make_user("student152@cs17test.com"), "Student 152")
		subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS152", "subject_name": "Maths 152"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 152",
					"passing_percentage": 40,
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		exam = (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam",
					"exam_name": "Quarter Exam 152",
					"cohort": cohort,
					"grading_scale": scale,
					"subjects": [{"subject": subject, "max_marks": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		marks = frappe.get_doc(
			{
				"doctype": "CS17 Subject Marks",
				"exam": exam,
				"student": student,
				"subject": subject,
				"components": [{"component": "Total", "marks_obtained": 39.9949999996}],
			}
		).insert(ignore_permissions=True)
		result = frappe.get_doc({"doctype": "CS17 Result", "exam": exam, "student": student}).insert(
			ignore_permissions=True
		)

		self.assertEqual(marks.is_pass, result.scores[0].is_pass)

	def test_saving_marks_again_keeps_the_total(self):
		cohort = make_cohort("C154TEST")
		student = make_profile("Student", cohort, make_user("student154@cs17test.com"), "Student 154")
		subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS154", "subject_name": "Maths 154"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 154",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		pattern = (
			frappe.get_doc(
				{
					"doctype": "CS17 Subject Pattern",
					"pattern_name": "Theory Practical 154",
					"components": [
						{"component": "Theory", "weightage": 50},
						{"component": "Practical", "weightage": 50},
					],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		exam = (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam",
					"exam_name": "Quarter Exam 154",
					"cohort": cohort,
					"grading_scale": scale,
					"subjects": [{"subject": subject, "max_marks": 100, "subject_pattern": pattern}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		marks = frappe.get_doc(
			{
				"doctype": "CS17 Subject Marks",
				"exam": exam,
				"student": student,
				"subject": subject,
				"components": [
					{"component": "Theory", "marks_obtained": 20.0000000004},
					{"component": "Practical", "marks_obtained": 19.9850000004},
				],
			}
		).insert(ignore_permissions=True)
		total = marks.total_marks_obtained

		marks.reload()
		marks.save()

		self.assertEqual(marks.total_marks_obtained, total)

	def test_component_maximum_matches_a_subject_maximum_with_three_decimals(self):
		cohort = make_cohort("C153TEST")
		student = make_profile("Student", cohort, make_user("student153@cs17test.com"), "Student 153")
		subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS153", "subject_name": "Maths 153"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 153",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		exam = (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam",
					"exam_name": "Quarter Exam 153",
					"cohort": cohort,
					"grading_scale": scale,
					"subjects": [{"subject": subject, "max_marks": 33.335}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		marks = frappe.get_doc(
			{"doctype": "CS17 Subject Marks", "exam": exam, "student": student, "subject": subject}
		).insert(ignore_permissions=True)

		self.assertEqual(marks.components[0].max_marks, 33.335)
