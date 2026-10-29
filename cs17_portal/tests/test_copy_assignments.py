# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class TestCopyAssignments(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C380TEST")
		cls.next_cohort = make_cohort("C381TEST")
		cls.faculty_user = make_user("faculty380@cs17test.com")
		cls.cohort_faculty_user = make_user("faculty381@cs17test.com")
		cls.student_user = make_user("student380@cs17test.com")
		make_profile("Faculty", None, cls.faculty_user, "Faculty 380")
		make_profile("Faculty", cls.cohort, cls.cohort_faculty_user, "Faculty 381")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Student 380")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_copy_keeps_the_work_of_the_assignment(self):
		assignment = api.create_assignment(
			"Square a Number 380",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			description="Print the square of the number read.",
			assignment_type="Graded",
			max_marks=20,
			remarks="Marks",
			starter_code="n = int(input())\n",
			test_cases=frappe.as_json([{"input": "3\n", "expected_output": "9\n", "is_hidden": 1}]),
			watch_tab_switches=1,
			time_limit=30,
			attempts_allowed=2,
			topic=api.create_topic("Functions 380"),
		)

		[copy] = api.copy_assignments([assignment], self.next_cohort)

		work = [
			"title",
			"description",
			"submission_type",
			"assignment_type",
			"max_marks",
			"remarks",
			"starter_code",
			"test_cases",
			"watch_tab_switches",
			"time_limit",
			"attempts_allowed",
			"topic",
		]
		source, copied = api.get_assignment(assignment), api.get_assignment(copy)
		self.assertEqual({key: copied[key] for key in work}, {key: source[key] for key in work})

	def test_copy_is_an_undated_draft_for_the_whole_chosen_cohort_and_quarter(self):
		quarter = (
			frappe.get_doc({"doctype": "CS17 Quarter", "quarter_name": "Quarter 380"})
			.insert(ignore_permissions=True)
			.name
		)
		assignment = api.create_assignment("PDF Task 380", self.cohort, "2030-01-01 00:00:00", publish="now")
		api.set_assignment_students(assignment, [self.student])

		[copy] = api.copy_assignments([assignment], self.next_cohort, quarter)

		copied = frappe.get_doc("CS17 Assignment", copy)
		self.assertEqual(
			(
				copied.cohort,
				copied.quarter,
				copied.is_published,
				copied.publish_on,
				copied.due_date,
				copied.students,
			),
			(self.next_cohort, quarter, 0, None, None, []),
		)

	def test_cohort_faculty_cannot_copy_into_another_cohort(self):
		frappe.set_user(self.cohort_faculty_user)
		assignment = api.create_assignment("PDF Task 381", self.cohort, "2030-01-01 00:00:00")

		self.assertRaises(frappe.PermissionError, api.copy_assignments, [assignment], self.next_cohort)

	def test_cohort_faculty_cannot_copy_an_assignment_of_another_cohort(self):
		assignment = api.create_assignment("PDF Task 382", self.next_cohort, "2030-01-01 00:00:00")

		frappe.set_user(self.cohort_faculty_user)
		self.assertRaises(frappe.PermissionError, api.copy_assignments, [assignment], self.cohort)
