# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_user


class TestStudentPage(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C409TEST")
		cls.faculty_user = make_user("faculty409@cs17test.com")
		cls.other_cohort_faculty_user = make_user("faculty410@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 409")
		make_profile("Faculty", make_cohort("C410TEST"), cls.other_cohort_faculty_user, "Faculty 410")
		cls.student = make_profile("Student", cls.cohort, make_user("student409@cs17test.com"), "Student 409")
		cls.other_student = make_profile(
			"Student", cls.cohort, make_user("student410@cs17test.com"), "Student 410"
		)

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_faculty_of_another_cohort_is_refused(self):
		frappe.set_user(self.other_cohort_faculty_user)

		self.assertRaises(frappe.PermissionError, api.get_student_overview, self.student)

	def test_lists_assignments_open_to_the_cohort_or_given_to_the_student(self):
		open_to_cohort = make_assignment(self.cohort, "Loops 409", "URL", 10)
		given = make_assignment(self.cohort, "Functions 409", "URL", 10)
		given_to_other = make_assignment(self.cohort, "Recursion 409", "URL", 10)
		api.set_assignment_students(given, [self.student])
		api.set_assignment_students(given_to_other, [self.other_student])

		listed = {row.name for row in api.get_student_overview(self.student)["assignments"]}
		self.assertEqual(listed & {open_to_cohort, given, given_to_other}, {open_to_cohort, given})

	def test_tab_leaves_are_counted_per_assignment(self):
		watched = make_assignment(self.cohort, "Squares 409", "Python", 10)
		other = make_assignment(self.cohort, "Cubes 409", "Python", 10)
		for student in (self.student, self.student, self.other_student):
			frappe.get_doc({"doctype": "CS17 Tab Leave", "assignment": watched, "student": student}).insert(
				ignore_permissions=True
			)

		counts = {
			row.name: row.tab_leave_count for row in api.get_student_overview(self.student)["assignments"]
		}
		self.assertEqual([counts[watched], counts[other]], [2, 0])

	def test_draft_result_is_listed(self):
		subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS409", "subject_name": "Maths 409"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 409",
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
					"exam_name": "Quarter Exam 409",
					"cohort": self.cohort,
					"grading_scale": scale,
					"subjects": [{"subject": subject}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		result = (
			frappe.get_doc({"doctype": "CS17 Result", "exam": exam, "student": self.student})
			.insert(ignore_permissions=True)
			.name
		)

		self.assertEqual(
			[row.name for row in api.get_student_overview(self.student)["results"]],
			[result],
		)
