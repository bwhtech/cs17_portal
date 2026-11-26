# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import now_datetime

from cs17_portal import api, common_errors
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestCommonErrors(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C610TEST")
		cls.faculty_user = make_user("faculty610@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student = make_profile(
			"Student", cls.cohort, make_user("student610@cs17test.com"), "Aarav Sharma"
		)
		cls.second_student = make_profile(
			"Student", cls.cohort, make_user("student611@cs17test.com"), "Diya Patel"
		)
		cls.other_faculty_user = make_user("faculty611@cs17test.com")
		make_profile("Faculty", make_cohort("C611TEST"), cls.other_faculty_user, "Rohan Mehta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Armstrong numbers", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)

	def add_run(self, student: str, error_type: str, error_line: int = 3):
		frappe.get_doc(
			{
				"doctype": "CS17 Code Run",
				"assignment": self.assignment,
				"student": student,
				"ran_at": now_datetime(),
				"error_type": error_type,
				"error_line": error_line,
			}
		).insert(ignore_permissions=True)

	def test_counts_each_student_once_per_error(self):
		self.add_run(self.student, "EOFError")
		self.add_run(self.student, "EOFError")
		self.add_run(self.second_student, "EOFError")

		[row] = common_errors.get_common_errors(self.cohort)

		self.assertEqual(
			(row.error_type, row.error_line, row.title, row.students), ("EOFError", 3, "Armstrong numbers", 2)
		)

	def test_shows_a_few_errors_per_topic(self):
		for line in range(common_errors.ERRORS_PER_TOPIC + 1):
			self.add_run(self.student, "NameError", line)

		self.assertEqual(len(common_errors.get_common_errors(self.cohort)), common_errors.ERRORS_PER_TOPIC)

	def test_leaves_out_assignments_of_another_quarter(self):
		self.add_run(self.student, "EOFError")
		quarter = (
			frappe.get_doc({"doctype": "CS17 Quarter", "quarter_name": "Quarter 610"})
			.insert(ignore_permissions=True)
			.name
		)

		self.assertEqual(common_errors.get_common_errors(self.cohort, quarter), [])

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, common_errors.get_common_errors, self.cohort)
