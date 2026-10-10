import frappe
from frappe.tests import IntegrationTestCase

from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class IntegrationTestCS17Exam(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C130TEST")
		cls.student = make_profile("Student", cls.cohort, make_user("student130@cs17test.com"), "Student 130")
		cls.maths, cls.science = (
			frappe.get_doc({"doctype": "CS17 Subject", "subject_code": code, "subject_name": name})
			.insert(ignore_permissions=True)
			.name
			for code, name in (("MATHS130", "Maths 130"), ("SCIENCE130", "Science 130"))
		)
		cls.scale, cls.project_scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": scale_name,
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
			for scale_name in ("Scale 130", "Project Scale 130")
		)

	def setUp(self):
		super().setUp()
		self.exam = frappe.get_doc(
			{
				"doctype": "CS17 Exam",
				"exam_name": "Quarter Exam 130",
				"cohort": self.cohort,
				"grading_scale": self.scale,
				"subjects": [{"subject": self.maths}, {"subject": self.science}],
			}
		).insert(ignore_permissions=True)
		self.maths_row, self.science_row = self.exam.subjects
		frappe.get_doc(
			{
				"doctype": "CS17 Subject Marks",
				"exam": self.exam.name,
				"student": self.student,
				"subject": self.maths,
				"components": [{"component": "Total", "marks_obtained": 82}],
			}
		).insert(ignore_permissions=True)

	def test_subject_with_marks_cannot_be_removed(self):
		self.exam.remove(self.maths_row)

		self.assertRaises(frappe.ValidationError, self.exam.save)

	def test_subject_on_a_result_cannot_be_removed(self):
		frappe.get_doc({"doctype": "CS17 Result", "exam": self.exam.name, "student": self.student}).insert(
			ignore_permissions=True
		)
		self.exam.remove(self.science_row)

		self.assertRaises(frappe.ValidationError, self.exam.save)

	def test_subject_without_marks_or_results_can_be_removed(self):
		self.exam.remove(self.science_row)
		self.exam.save()

		self.assertFalse(
			frappe.db.exists("CS17 Exam Subject", {"parent": self.exam.name, "subject": self.science})
		)

	def test_subject_not_yet_on_a_result_can_be_removed(self):
		frappe.get_doc({"doctype": "CS17 Result", "exam": self.exam.name, "student": self.student}).insert(
			ignore_permissions=True
		)
		english = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "ENGLISH130", "subject_name": "English 130"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		english_row = self.exam.append("subjects", {"subject": english})
		self.exam.save()

		self.exam.remove(english_row)
		self.exam.save()

		self.assertFalse(
			frappe.db.exists("CS17 Exam Subject", {"parent": self.exam.name, "subject": english})
		)

	def test_max_marks_cannot_change_once_marks_exist_even_at_zero(self):
		frappe.get_doc(
			{
				"doctype": "CS17 Subject Marks",
				"exam": self.exam.name,
				"student": self.student,
				"subject": self.science,
				"components": [{"component": "Total", "marks_obtained": 0}],
			}
		).insert(ignore_permissions=True)
		self.science_row.max_marks = 50

		self.assertRaises(frappe.ValidationError, self.exam.save)

	def test_subject_grading_scale_cannot_change_once_marks_exist(self):
		self.maths_row.grading_scale = self.project_scale

		self.assertRaises(frappe.ValidationError, self.exam.save)

	def test_exam_grading_scale_cannot_change_once_marks_exist(self):
		self.exam.grading_scale = self.project_scale

		self.assertRaises(frappe.ValidationError, self.exam.save)
