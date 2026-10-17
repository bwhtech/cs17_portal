# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, now

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestGradingMarksAssignment(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cohort = make_cohort("C160TEST")
		cls.faculty_user = make_user("faculty160@cs17test.com")
		make_profile("Faculty", cohort, cls.faculty_user, "Faculty 160")
		student = make_profile("Student", cohort, make_user("student160@cs17test.com"), "Student 160")

		frappe.set_user(cls.faculty_user)
		assignment = make_assignment(cohort, "PDF Task 160", "PDF", 20)
		frappe.set_user("Administrator")
		frappe.db.set_value("CS17 Assignment", assignment, "remarks", "Marks")

		cls.submission = make_submission(assignment, student, "Student 160", "PDF Task 160")

	def setUp(self):
		frappe.set_user(self.faculty_user)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_save_grade_refuses_a_marks_assignment_without_marks(self):
		self.assertRaises(frappe.ValidationError, api.save_grade, self.submission)

	def test_grade_submission_refuses_a_marks_assignment_without_marks(self):
		self.assertRaises(frappe.ValidationError, api.grade_submission, self.submission)

	def test_scheduled_assignment_published_now_loses_its_schedule(self):
		assignment = api.create_assignment(
			"PDF Task 161",
			make_cohort("C160TEST"),
			"2030-01-01 00:00:00",
			publish="schedule",
			publish_on=add_days(now(), 1),
		)

		api.publish_assignment(assignment)

		self.assertIsNone(frappe.db.get_value("CS17 Assignment", assignment, "publish_on"))

	def test_grade_submission_refuses_to_schedule_a_published_grade(self):
		grade = api.grade_submission(self.submission, marks_obtained=15, publish="now")["name"]
		self.addCleanup(frappe.delete_doc, "CS17 Assignment Grade", grade)

		self.assertRaises(
			frappe.ValidationError,
			api.grade_submission,
			self.submission,
			marks_obtained=15,
			publish="schedule",
			publish_on=add_days(now(), 1),
		)

	def test_grade_submission_keeps_the_publish_state_the_caller_left_out(self):
		grade = api.grade_submission(self.submission, marks_obtained=15, publish="now")["name"]
		self.addCleanup(frappe.delete_doc, "CS17 Assignment Grade", grade)

		api.grade_submission(self.submission, marks_obtained=15)

		self.assertEqual(frappe.db.get_value("CS17 Assignment Grade", grade, "is_published"), 1)
