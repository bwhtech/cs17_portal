# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api, topic_progress
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestTopicProgress(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C650TEST")
		cls.faculty_user = make_user("faculty650@cs17test.com")
		cls.other_faculty_user = make_user("faculty651@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		make_profile("Faculty", make_cohort("C651TEST"), cls.other_faculty_user, "Rohan Gupta")
		cls.student_user = make_user("student650@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.classmate = make_profile(
			"Student", cls.cohort, make_user("student651@cs17test.com"), "Diya Patel"
		)
		frappe.get_doc({"doctype": "CS17 Topic", "topic_name": "Loops"}).insert(
			ignore_permissions=True, ignore_if_duplicate=True
		)

		frappe.set_user(cls.faculty_user)
		practice = cls.make_marks_assignment("Loops practice", "Loops", 20)
		for student, full_name, marks in (
			(cls.student, "Aarav Sharma", 15),
			(cls.classmate, "Diya Patel", 10),
		):
			api.grade_submission(
				make_submission(practice, student, full_name, "Loops practice"),
				marks_obtained=marks,
				publish="now",
			)
		quiz = cls.make_marks_assignment("Loops quiz", "Loops", 20)
		api.grade_submission(
			make_submission(quiz, cls.student, "Aarav Sharma", "Loops quiz"), marks_obtained=5
		)
		api.set_assignment_students(cls.make_marks_assignment("Loops homework", "Loops", 20), [cls.classmate])
		frappe.db.set_value(
			"CS17 Assignment", cls.make_marks_assignment("Loops challenge", "Loops", 20), "is_published", 0
		)
		frappe.db.set_value(
			"CS17 Assignment", cls.make_marks_assignment("Loops essay", "Loops", 20), "remarks", "Grade"
		)
		guessing = cls.make_marks_assignment("Number guessing", None, 10)
		frappe.db.set_value("CS17 Assignment", guessing, "due_date", "2030-02-01 00:00:00")
		api.grade_submission(
			make_submission(guessing, cls.student, "Aarav Sharma", "Number guessing"),
			marks_obtained=8,
			publish="now",
		)
		frappe.set_user("Administrator")

	@classmethod
	def make_marks_assignment(cls, title: str, topic: str | None, max_marks: float) -> str:
		assignment = make_assignment(cls.cohort, title, "PDF", max_marks)
		frappe.db.set_value(
			"CS17 Assignment", assignment, {"assignment_type": "Graded", "remarks": "Marks", "topic": topic}
		)
		return assignment

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_counts_published_marks_work_given_to_the_student(self):
		self.assertEqual(
			{
				row["topic"]: (row["given"], row["submitted"])
				for row in topic_progress.get_student_topic_progress(self.student)
			},
			{"No topic": (1, 1), "Loops": (2, 2)},
		)

	def test_average_is_published_marks_over_their_max_marks(self):
		self.assertEqual(
			{row["topic"]: row["average"] for row in topic_progress.get_student_topic_progress(self.student)},
			{"No topic": 80.0, "Loops": 75.0},
		)

	def test_topics_follow_the_latest_due_assignment(self):
		self.assertEqual(
			[row["topic"] for row in topic_progress.get_student_topic_progress(self.student)],
			["No topic", "Loops"],
		)

	def test_student_sees_work_with_no_topic_under_other(self):
		frappe.set_user(self.student_user)

		self.assertEqual([row["topic"] for row in topic_progress.get_my_topic_progress()], ["Other", "Loops"])

	def test_class_progress_adds_up_every_student(self):
		self.assertEqual(
			{
				row["topic"]: (row["given"], row["submitted"], row["average"])
				for row in topic_progress.get_class_topic_progress(self.cohort)
			},
			{"No topic": (2, 1, 80.0), "Loops": (5, 3, 62.5)},
		)

	def test_refuses_faculty_of_another_cohort_the_student(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, topic_progress.get_student_topic_progress, self.student)

	def test_refuses_faculty_of_another_cohort_the_class(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, topic_progress.get_class_topic_progress, self.cohort)
