# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from cs17_portal import api, coding_exam, exam_live, live_lab
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user

CODE = "print(int(input()) ** 2)"


def from_now(**kwargs) -> str:
	return str(add_to_date(now_datetime(), **kwargs))


class TestExamLive(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C880TEST")
		cls.faculty_user = make_user("faculty880@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student880@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.second_student_user = make_user("student881@cs17test.com")
		cls.second_student = make_profile("Student", cls.cohort, cls.second_student_user, "Diya Patel")
		cls.other_faculty_user = make_user("faculty881@cs17test.com")
		make_profile("Faculty", make_cohort("C881TEST"), cls.other_faculty_user, "Rohan Gupta")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.questions = [
			api.create_assignment(
				title,
				self.cohort,
				"2030-01-01 00:00:00",
				submission_type="Python",
				test_cases=frappe.as_json([{"input": "3\n", "expected_output": "9\n", "is_hidden": 0}]),
			)
			for title in ("Loops practice", "Number guessing")
		]
		self.exam = coding_exam.save_coding_exam(
			title="Python midterm",
			cohort=self.cohort,
			duration_minutes=120,
			opens_on=from_now(minutes=-10),
			last_start_on=from_now(minutes=30),
			closes_on=from_now(hours=3),
			question_order="Any order",
			questions=[{"assignment": question, "marks": 10} for question in self.questions],
			is_published=1,
		)

	def start(self, user: str) -> None:
		frappe.set_user(user)
		coding_exam.start_coding_exam(self.exam)

	def save_answer(self, question: str) -> str:
		project = coding_exam.open_exam_question(self.exam, question)["project"]
		api.save_python_project(project, CODE)
		return project

	def add_event(self, kind: str, **fields) -> str:
		return (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam Event",
					"exam": self.exam,
					"student": self.student,
					"kind": kind,
					"occurred_at": now_datetime(),
					**fields,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	def get_exam_live(self, since: str | None = None) -> dict:
		frappe.set_user(self.faculty_user)
		return exam_live.get_exam_live(self.exam, since)

	def get_row(self, student: str) -> dict:
		return next(row for row in self.get_exam_live()["students"] if row.student == student)

	def test_the_current_question_is_the_one_saved_last(self):
		self.start(self.student_user)
		self.save_answer(self.questions[0])
		self.save_answer(self.questions[1])

		self.assertEqual(self.get_row(self.student).current_question, self.questions[1])

	def test_a_question_shows_its_latest_test_check(self):
		self.start(self.student_user)
		project = self.save_answer(self.questions[0])
		live_lab.record_code_run(project, passed=1, total=2)
		live_lab.record_code_run(project, error_type="NameError", error_line=4)

		question = self.get_row(self.student).questions[0]

		self.assertEqual((question["passed"], question["total"]), (1, 2))

	def test_a_student_idle_for_ten_minutes_comes_first(self):
		self.start(self.student_user)
		self.start(self.second_student_user)
		frappe.set_user("Administrator")
		frappe.db.set_value(
			"CS17 Coding Exam Attempt",
			{"exam": self.exam, "student": self.second_student},
			"started_at",
			from_now(minutes=-11),
		)

		students = self.get_exam_live()["students"]

		self.assertEqual(
			[(row.full_name, row.stuck) for row in students[:2]],
			[("Diya Patel", True), ("Aarav Sharma", False)],
		)

	def test_a_student_failing_the_current_question_for_five_minutes_is_stuck(self):
		self.start(self.student_user)
		self.save_answer(self.questions[0])
		frappe.get_doc(
			{
				"doctype": "CS17 Code Run",
				"assignment": self.questions[0],
				"student": self.student,
				"ran_at": from_now(minutes=-6),
				"passed": 0,
				"total": 1,
			}
		).insert(ignore_permissions=True)

		self.assertTrue(self.get_row(self.student).stuck)

	def test_alerts_leave_out_kinds_the_exam_does_not_watch(self):
		frappe.db.set_value("CS17 Coding Exam", self.exam, "alert_kinds", "tab_leave\nfullscreen_exit")
		self.add_event("tab_leave", seconds=42)
		self.add_event("copy_question")

		self.assertEqual([event.kind for event in self.get_exam_live()["events"]], ["tab_leave"])

	def test_since_leaves_out_events_not_changed_after_it(self):
		event = self.add_event("tab_leave")
		frappe.db.set_value("CS17 Exam Event", event, "modified", from_now(minutes=-5), update_modified=False)

		self.assertEqual(self.get_exam_live(since=from_now(minutes=-1))["events"], [])

	def test_faculty_of_another_cohort_cannot_watch_the_exam(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, exam_live.get_exam_live, self.exam)

	def test_view_code_returns_the_latest_autosave(self):
		self.start(self.student_user)
		self.save_answer(self.questions[0])
		frappe.set_user(self.faculty_user)

		self.assertEqual(
			exam_live.get_exam_question_code(self.exam, self.student, self.questions[0]).code, CODE
		)
