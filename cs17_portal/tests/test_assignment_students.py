# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import get_quarter_assignments
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	submit_assignment,
)
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestAssignmentStudents(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C270TEST")
		cls.faculty_user = make_user("faculty270@cs17test.com")
		cls.student_270_user = make_user("student270@cs17test.com")
		cls.student_271_user = make_user("student271@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 270")
		cls.student_270 = make_profile("Student", cls.cohort, cls.student_270_user, "Student 270")
		cls.student_271 = make_profile("Student", cls.cohort, cls.student_271_user, "Student 271")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_get_student_assignments_lists_an_assignment_only_for_its_students(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 270", "PDF", 0)
		api.set_assignment_students(assignment, [self.student_270])

		frappe.set_user(self.student_270_user)
		self.assertIn(assignment, [row.name for row in api.get_student_assignments()["assignments"]])
		frappe.set_user(self.student_271_user)
		self.assertNotIn(assignment, [row.name for row in api.get_student_assignments()["assignments"]])

	def test_get_student_assignment_is_not_found_for_a_student_left_off(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 271", "PDF", 0)
		api.set_assignment_students(assignment, [self.student_270])

		frappe.set_user(self.student_271_user)
		self.assertRaises(frappe.DoesNotExistError, api.get_student_assignment, assignment)

	def test_a_student_left_off_cannot_submit(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "URL Task 272", "URL", 0)
		api.set_assignment_students(assignment, [self.student_270])

		frappe.set_user(self.student_271_user)
		self.assertRaisesRegex(
			frappe.ValidationError,
			"This assignment is not open for submission.",
			submit_assignment,
			assignment,
			"https://example.com/task-272",
		)

	def test_quarter_assignments_leave_out_an_assignment_given_to_others(self):
		quarter = (
			frappe.get_doc({"doctype": "CS17 Quarter", "quarter_name": "Quarter 273"})
			.insert(ignore_permissions=True)
			.name
		)
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 273", "PDF", 0)
		frappe.db.set_value("CS17 Assignment", assignment, "quarter", quarter)
		api.set_assignment_students(assignment, [self.student_270])

		self.assertEqual(get_quarter_assignments(quarter, self.cohort, self.student_271), [])

	def test_get_assignment_submissions_lists_only_its_students_as_not_submitted(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 274", "PDF", 0)
		api.set_assignment_students(assignment, [self.student_270])

		not_submitted = api.get_assignment_submissions(assignment)["not_submitted"]

		self.assertEqual([row.student for row in not_submitted], [self.student_270])

	def test_get_faculty_assignments_counts_the_students(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 275", "PDF", 0)
		api.set_assignment_students(assignment, [self.student_270])

		row = next(row for row in api.get_faculty_assignments() if row.name == assignment)

		self.assertEqual(row.student_count, 1)

	def test_a_student_of_another_cohort_is_refused(self):
		other_student = make_profile(
			"Student", make_cohort("C276TEST"), make_user("student276@cs17test.com"), "Student 276"
		)
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 276", "PDF", 0)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Student 276 is not a student of this cohort.",
			api.set_assignment_students,
			assignment,
			[other_student],
		)

	def test_a_student_listed_twice_is_refused(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 277", "PDF", 0)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Student 270 is listed more than once.",
			api.set_assignment_students,
			assignment,
			[self.student_270, self.student_270],
		)

	def test_a_student_who_submitted_cannot_be_left_off(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 278", "PDF", 0)
		make_submission(assignment, self.student_270, "Student 270", "PDF Task 278")

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Student 270 has already submitted this assignment.",
			api.set_assignment_students,
			assignment,
			[self.student_271],
		)

	def test_distribute_assignments_gives_each_student_exactly_one(self):
		student_279 = make_profile(
			"Student", self.cohort, make_user("student279@cs17test.com"), "Student 279"
		)
		frappe.set_user(self.faculty_user)
		assignments = [
			make_assignment(self.cohort, "PDF Task 279", "PDF", 0),
			make_assignment(self.cohort, "PDF Task 280", "PDF", 0),
		]

		api.distribute_assignments(assignments)

		rows = frappe.get_all(
			"CS17 Assignment Student", filters={"parent": ["in", assignments]}, fields=["parent", "student"]
		)
		self.assertCountEqual(
			[row.student for row in rows], [self.student_270, self.student_271, student_279]
		)
		self.assertCountEqual(
			[len([row for row in rows if row.parent == name]) for name in assignments], [1, 2]
		)

	def test_distribute_assignments_is_refused_once_a_student_submitted(self):
		frappe.set_user(self.faculty_user)
		assignments = [
			make_assignment(self.cohort, "PDF Task 281", "PDF", 0),
			make_assignment(self.cohort, "PDF Task 282", "PDF", 0),
		]
		make_submission(assignments[0], self.student_270, "Student 270", "PDF Task 281")

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Hand these out before students submit.",
			api.distribute_assignments,
			assignments,
		)

	def test_get_finished_students_lists_only_who_submitted_theirs(self):
		frappe.set_user(self.faculty_user)
		assignments = [
			make_assignment(self.cohort, "PDF Task 284", "PDF", 0),
			make_assignment(self.cohort, "PDF Task 285", "PDF", 0),
		]
		api.set_assignment_students(assignments[0], [self.student_270])
		api.set_assignment_students(assignments[1], [self.student_271])
		make_submission(assignments[0], self.student_270, "Student 270", "PDF Task 284")

		self.assertEqual([row.student for row in api.get_finished_students(assignments)], [self.student_270])

	def test_distribute_next_assignments_gives_each_student_a_different_one_they_had_not(self):
		student_287 = make_profile(
			"Student", self.cohort, make_user("student287@cs17test.com"), "Student 287"
		)
		student_288 = make_profile(
			"Student", self.cohort, make_user("student288@cs17test.com"), "Student 288"
		)
		frappe.set_user(self.faculty_user)
		assignments = [
			make_assignment(self.cohort, "PDF Task 286", "PDF", 0),
			make_assignment(self.cohort, "PDF Task 287", "PDF", 0),
			make_assignment(self.cohort, "PDF Task 288", "PDF", 0),
		]
		api.set_assignment_students(assignments[0], [self.student_270, self.student_271])
		api.set_assignment_students(assignments[1], [student_287])
		api.set_assignment_students(assignments[2], [student_288])

		api.distribute_next_assignments(assignments, [self.student_270, self.student_271])

		received = frappe.get_all(
			"CS17 Assignment Student",
			filters={
				"parent": ["in", assignments[1:]],
				"student": ["in", [self.student_270, self.student_271]],
			},
			pluck="parent",
		)
		self.assertCountEqual(received, assignments[1:])

	def test_distribute_next_assignments_leaves_an_assignment_open_to_everyone(self):
		frappe.set_user(self.faculty_user)
		assignments = [
			make_assignment(self.cohort, "PDF Task 289", "PDF", 0),
			make_assignment(self.cohort, "PDF Task 290", "PDF", 0),
		]
		api.set_assignment_students(assignments[0], [self.student_270])

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Student 270 already has every one of these assignments.",
			api.distribute_next_assignments,
			assignments,
			[self.student_270],
		)

	def test_open_assignments_to_cohort_clears_the_students(self):
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "PDF Task 283", "PDF", 0)
		api.set_assignment_students(assignment, [self.student_270])

		api.open_assignments_to_cohort([assignment])

		self.assertFalse(frappe.db.exists("CS17 Assignment Student", {"parent": assignment}))
