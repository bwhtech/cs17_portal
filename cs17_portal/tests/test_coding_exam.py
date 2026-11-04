# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, get_datetime, now_datetime

from cs17_portal import api, coding_exam, tasks
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user

CODE = "print(int(input()) ** 2)"


def from_now(**kwargs) -> str:
	return str(add_to_date(now_datetime(), **kwargs))


class TestCodingExam(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C830TEST")
		cls.faculty_user = make_user("faculty830@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student830@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.other_cohort = make_cohort("C831TEST")
		cls.other_faculty_user = make_user("faculty831@cs17test.com")
		make_profile("Faculty", cls.other_cohort, cls.other_faculty_user, "Rohan Gupta")
		cls.other_student_user = make_user("student831@cs17test.com")
		make_profile("Student", cls.other_cohort, cls.other_student_user, "Diya Patel")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")

	def make_question(self, title: str) -> str:
		frappe.set_user(self.faculty_user)
		return api.create_assignment(
			title,
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			test_cases=frappe.as_json([{"input": "3\n", "expected_output": "9\n", "is_hidden": 0}]),
		)

	def make_exam(
		self,
		question_order: str = "Any order",
		can_go_back: int = 0,
		opens_on: str | None = None,
		questions: list[str] | None = None,
	) -> tuple[str, list[str]]:
		questions = questions or [self.make_question("Loops practice"), self.make_question("Number guessing")]
		exam = coding_exam.save_coding_exam(
			title="Python midterm",
			cohort=self.cohort,
			duration_minutes=120,
			opens_on=opens_on or from_now(minutes=-10),
			last_start_on=from_now(minutes=30),
			closes_on=from_now(hours=3),
			question_order=question_order,
			can_go_back=can_go_back,
			questions=[{"assignment": question, "marks": 10} for question in questions],
			is_published=1,
		)
		return exam, questions

	def start(self, exam: str) -> dict:
		frappe.set_user(self.student_user)
		return coding_exam.start_coding_exam(exam)

	def save_answer(self, exam: str, question: str) -> None:
		project = coding_exam.open_exam_question(exam, question)["project"]
		api.save_python_project(project, CODE)

	def test_start_is_refused_before_the_exam_opens(self):
		exam, _ = self.make_exam(opens_on=from_now(minutes=10))
		frappe.set_user(self.student_user)

		self.assertRaisesRegex(
			frappe.ValidationError, "^This exam is not open yet", coding_exam.start_coding_exam, exam
		)

	def test_one_by_one_locks_the_next_question(self):
		exam, questions = self.make_exam("One by one")
		self.start(exam)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"^This question is locked",
			coding_exam.open_exam_question,
			exam,
			questions[1],
		)

	def test_skip_opens_the_next_question(self):
		exam, questions = self.make_exam("One by one")
		self.start(exam)
		coding_exam.skip_exam_question(exam, questions[0])

		self.assertTrue(coding_exam.open_exam_question(exam, questions[1])["project"])

	def test_a_skipped_question_locks_when_going_back_is_off(self):
		exam, questions = self.make_exam("One by one")
		self.start(exam)
		coding_exam.skip_exam_question(exam, questions[0])

		self.assertTrue(coding_exam.get_my_coding_exam(exam)["questions"][0].is_locked)

	def test_finish_submits_the_saved_code(self):
		exam, questions = self.make_exam()
		self.start(exam)
		self.save_answer(exam, questions[0])
		coding_exam.finish_coding_exam(exam)

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment Submission", {"assignment": questions[0]}, "code"), CODE
		)

	def test_time_up_submits_the_saved_code(self):
		exam, questions = self.make_exam()
		self.start(exam)
		self.save_answer(exam, questions[0])
		frappe.set_user("Administrator")
		frappe.db.set_value("CS17 Coding Exam Attempt", {"exam": exam}, "ends_at", from_now(minutes=-1))
		tasks.submit_saved_work_when_time_is_up()

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment Submission", {"assignment": questions[0]}, "code"), CODE
		)

	def test_extra_time_moves_the_end(self):
		exam, _ = self.make_exam()
		ends_at = get_datetime(self.start(exam)["ends_at"])
		frappe.set_user(self.faculty_user)
		coding_exam.add_exam_time(exam, 10, self.student)
		frappe.set_user(self.student_user)

		self.assertEqual(
			coding_exam.get_my_coding_exam(exam)["attempt"]["ends_at"], add_to_date(ends_at, minutes=10)
		)

	def test_resume_moves_the_end_by_the_time_paused(self):
		exam, _ = self.make_exam()
		ends_at = get_datetime(self.start(exam)["ends_at"])
		frappe.set_user(self.faculty_user)
		coding_exam.pause_coding_exam(exam)
		frappe.db.set_value("CS17 Coding Exam Attempt", {"exam": exam}, "paused_at", from_now(minutes=-5))
		coding_exam.resume_coding_exam(exam)

		self.assertEqual(
			frappe.db.get_value("CS17 Coding Exam Attempt", {"exam": exam}, "ends_at"),
			add_to_date(ends_at, minutes=5),
		)

	def test_an_exam_refuses_a_published_assignment(self):
		question = self.make_question("Loops practice")
		api.publish_assignment(question)

		self.assertRaisesRegex(
			frappe.ValidationError, "^Use a draft assignment", self.make_exam, questions=[question]
		)

	def test_an_exam_question_cannot_be_published(self):
		_, questions = self.make_exam()

		self.assertRaisesRegex(
			frappe.ValidationError,
			"^This assignment is a coding exam question",
			api.publish_assignment,
			questions[0],
		)

	def test_the_faculty_list_names_the_exam_of_a_question(self):
		exam, questions = self.make_exam()

		exams = {row.name: row.coding_exam for row in api.get_faculty_assignments()}
		self.assertEqual(exams[questions[0]], exam)

	def test_a_question_is_left_out_of_the_assignment_list(self):
		_, questions = self.make_exam()
		frappe.db.set_value("CS17 Assignment", questions[0], "is_published", 1)
		frappe.set_user(self.student_user)

		self.assertNotIn(questions[0], [row.name for row in api.get_student_assignments()["assignments"]])

	def test_the_student_page_lists_the_questions_of_a_started_exam(self):
		exam, questions = self.make_exam()
		self.start(exam)
		frappe.set_user(self.faculty_user)

		self.assertIn(
			questions[0], [row.name for row in api.get_student_overview(self.student)["assignments"]]
		)

	def test_a_question_is_closed_before_the_exam_starts(self):
		_, questions = self.make_exam()
		frappe.set_user(self.student_user)

		self.assertTrue(api.is_assignment_closed(questions[0]))

	def test_a_student_of_another_cohort_cannot_see_the_exam(self):
		exam, _ = self.make_exam()
		frappe.set_user(self.other_student_user)

		self.assertRaises(frappe.DoesNotExistError, coding_exam.get_my_coding_exam, exam)

	def test_extra_time_for_everyone_moves_a_close_time_that_would_cut_it_short(self):
		exam, _ = self.make_exam()
		self.start(exam)
		frappe.set_user(self.faculty_user)
		coding_exam.set_exam_closes_on(exam, from_now(minutes=60))
		closes_on = get_datetime(frappe.db.get_value("CS17 Coding Exam", exam, "closes_on"))
		coding_exam.add_exam_time(exam, 10)
		frappe.set_user(self.student_user)

		self.assertEqual(
			coding_exam.get_my_coding_exam(exam)["attempt"]["ends_at"], add_to_date(closes_on, minutes=10)
		)

	def test_extra_time_for_one_student_past_the_close_time_is_refused(self):
		exam, _ = self.make_exam()
		self.start(exam)
		frappe.set_user(self.faculty_user)
		coding_exam.set_exam_closes_on(exam, from_now(minutes=60))

		self.assertRaises(frappe.ValidationError, coding_exam.add_exam_time, exam, 10, self.student)

	def test_faculty_of_another_cohort_cannot_add_time(self):
		exam, _ = self.make_exam()
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, coding_exam.add_exam_time, exam, 10)

	def test_time_up_submits_the_saved_work_of_a_timed_assignment(self):
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"Squares practice",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			publish="now",
			time_limit=30,
			submit_saved_work=1,
		)
		frappe.set_user(self.student_user)
		api.save_python_project(api.start_python_assignment(assignment)["name"], CODE)
		frappe.set_user("Administrator")
		frappe.db.set_value(
			"CS17 Assignment Attempt", {"assignment": assignment}, "started_at", from_now(minutes=-31)
		)
		tasks.submit_saved_work_when_time_is_up()

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment Submission", {"assignment": assignment}, "code"), CODE
		)
