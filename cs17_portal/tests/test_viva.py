# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import viva
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestViva(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cohort = make_cohort("C611TEST")
		cls.faculty_user = make_user("faculty611@cs17test.com")
		cls.other_faculty_user = make_user("faculty612@cs17test.com")
		make_profile("Faculty", cohort, cls.faculty_user, "Faculty 611")
		make_profile("Faculty", make_cohort("C612TEST"), cls.other_faculty_user, "Faculty 612")
		cls.student = make_profile("Student", cohort, make_user("student611@cs17test.com"), "Student 611")

		cls.subject = (
			frappe.get_doc({"doctype": "CS17 Subject", "subject_code": "VIVA611", "subject_name": "Viva 611"})
			.insert()
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 611",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert()
			.name
		)
		cls.exam = (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam",
					"exam_name": "Quarter Exam 611",
					"cohort": cohort,
					"grading_scale": scale,
					"subjects": [{"subject": cls.subject, "max_marks": 5}],
				}
			)
			.insert()
			.name
		)
		cls.viva = frappe.get_doc(
			{
				"doctype": "CS17 Viva",
				"exam": cls.exam,
				"subject": cls.subject,
				"component": "Total",
				"questions": [
					{
						"section": "Program",
						"question": "What shows on screen?",
						"code": "print(1)\nprint(x)",
						"answer": "1, then NameError",
						"marks": 3,
					},
					{
						"section": "Program",
						"question": "What shows on screen?",
						"code": "print(2)\nprint(1 / 0)",
						"answer": "2, then ZeroDivisionError",
						"marks": 3,
					},
					{"section": "Basics", "question": "What does 7 // 2 give?", "answer": "3", "marks": 1},
					{
						"section": "Loops",
						"question": "What does range(3) give?",
						"answer": "0 1 2",
						"marks": 1,
					},
				],
			}
		).insert()
		cls.program, cls.other_program, cls.basics, cls.loops = (row.name for row in cls.viva.questions)

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_marks_go_into_the_subject_marks(self):
		viva.save_viva_marks(self.viva.name, self.student, {self.program: 2, self.basics: 1, self.loops: 1})

		self.assertEqual(
			frappe.db.get_value(
				"CS17 Subject Marks",
				{"exam": self.exam, "student": self.student, "subject": self.subject},
				"total_marks_obtained",
			),
			4,
		)

	def test_marking_again_replaces_the_earlier_marks(self):
		viva.save_viva_marks(self.viva.name, self.student, {self.program: 2, self.basics: 1, self.loops: 1})
		viva.save_viva_marks(
			self.viva.name, self.student, {self.other_program: 3, self.basics: 0, self.loops: 1}
		)

		marks = frappe.get_all(
			"CS17 Viva Mark",
			filters={"viva": self.viva.name, "student": self.student},
			fields=["question", "marks_obtained"],
		)
		self.assertEqual(
			{row.question: row.marks_obtained for row in marks},
			{self.other_program: 3, self.basics: 0, self.loops: 1},
		)

	def test_marks_above_the_question_marks_are_refused(self):
		with self.assertRaises(frappe.ValidationError):
			viva.save_viva_marks(
				self.viva.name, self.student, {self.program: 4, self.basics: 1, self.loops: 1}
			)

	def test_a_section_left_out_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			viva.save_viva_marks(self.viva.name, self.student, {self.program: 3, self.basics: 1})

	def test_faculty_of_another_cohort_cannot_open_the_viva(self):
		frappe.set_user(self.other_faculty_user)

		with self.assertRaises(frappe.PermissionError):
			viva.get_viva(self.viva.name)

	def test_students_whose_user_is_disabled_are_left_out(self):
		make_profile("Student", self.viva.cohort, make_user("left611@cs17test.com"), "Left 611")
		frappe.db.set_value("User", "left611@cs17test.com", "enabled", 0)

		self.assertEqual(
			[row["student"] for row in viva.get_viva(self.viva.name)["students"]], [self.student]
		)
		self.assertEqual([row.students for row in viva.get_vivas()], [1])

	def test_sections_must_add_up_to_the_part_marks(self):
		doc = frappe.copy_doc(self.viva)
		doc.append(
			"questions",
			{
				"section": "Errors",
				"question": "What does int('ten') raise?",
				"answer": "ValueError",
				"marks": 1,
			},
		)

		with self.assertRaises(frappe.ValidationError):
			doc.insert(ignore_permissions=True)

	def test_an_asked_question_cannot_be_removed(self):
		viva.save_viva_marks(self.viva.name, self.student, {self.program: 2, self.basics: 1, self.loops: 1})
		doc = frappe.get_doc("CS17 Viva", self.viva.name)
		doc.set("questions", [row for row in doc.questions if row.name != self.program])

		with self.assertRaises(frappe.ValidationError):
			doc.save(ignore_permissions=True)
