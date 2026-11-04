# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.sessions import hash_sid
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now, now_datetime

from cs17_portal import api, coding_exam, exam_activity, tasks
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user

LONG_CODE = "\n".join(f"print({number})" for number in range(20))


def from_now(**kwargs) -> str:
	return str(add_to_date(now_datetime(), **kwargs))


class TestExamActivity(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C840TEST")
		cls.faculty_user = make_user("faculty840@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student840@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")

	def start_exam(self, **rules) -> tuple[str, str]:
		frappe.set_user(self.faculty_user)
		question = api.create_assignment(
			"Loops practice",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			test_cases=frappe.as_json([{"input": "3\n", "expected_output": "9\n", "is_hidden": 0}]),
		)
		exam = coding_exam.save_coding_exam(
			title="Python midterm",
			cohort=self.cohort,
			duration_minutes=120,
			opens_on=from_now(minutes=-10),
			last_start_on=from_now(minutes=30),
			closes_on=from_now(hours=3),
			question_order="Any order",
			questions=[{"assignment": question, "marks": 10}],
			is_published=1,
			**rules,
		)
		frappe.set_user(self.student_user)
		coding_exam.start_coding_exam(exam)
		return exam, question

	def events(self, exam: str, kind: str) -> list:
		return frappe.get_all(
			"CS17 Exam Event", filters={"exam": exam, "kind": kind}, fields=["seconds", "detail"]
		)

	def test_a_tab_leave_gets_its_seconds_on_return(self):
		exam, _ = self.start_exam()
		exam_activity.record_exam_event(exam, "tab_leave")
		exam_activity.record_exam_event(exam, "tab_leave", seconds=42)

		self.assertEqual([event.seconds for event in self.events(exam, "tab_leave")], [42])

	def test_an_event_is_refused_after_the_exam_is_finished(self):
		exam, _ = self.start_exam()
		coding_exam.finish_coding_exam(exam)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"^You have finished this exam",
			exam_activity.record_exam_event,
			exam,
			"tab_leave",
		)

	def test_a_server_signal_is_refused_from_the_student(self):
		exam, _ = self.start_exam()

		self.assertRaisesRegex(
			frappe.ValidationError,
			"^Unknown exam event",
			exam_activity.record_exam_event,
			exam,
			"second_login",
		)

	def test_the_leave_limit_flags_once(self):
		exam, _ = self.start_exam(leave_limit=2)
		for _leave in range(3):
			exam_activity.record_exam_event(exam, "tab_leave")

		self.assertEqual(
			[event.detail for event in self.events(exam, "rule_action")], ["Flagged after 2 leaves"]
		)

	def test_the_leave_limit_locks_the_question(self):
		exam, question = self.start_exam(leave_limit=1, leave_action="Lock question")
		exam_activity.record_exam_event(exam, "tab_leave", question)

		self.assertTrue(coding_exam.get_my_coding_exam(exam)["questions"][0].is_locked)

	def test_reopening_a_locked_question_unlocks_it(self):
		exam, question = self.start_exam(leave_limit=1, leave_action="Lock question")
		exam_activity.record_exam_event(exam, "tab_leave", question)
		frappe.set_user(self.faculty_user)
		coding_exam.reopen_exam_question(exam, self.student, question)
		frappe.set_user(self.student_user)

		self.assertFalse(coding_exam.get_my_coding_exam(exam)["questions"][0].is_locked)

	def test_reopening_the_exam_gives_back_the_time_left(self):
		exam, _ = self.start_exam()
		coding_exam.finish_coding_exam(exam)
		frappe.db.set_value("CS17 Coding Exam Attempt", {"exam": exam}, "finished_on", from_now(minutes=-20))
		ends_at = frappe.db.get_value("CS17 Coding Exam Attempt", {"exam": exam}, "ends_at")
		frappe.set_user(self.faculty_user)
		coding_exam.reopen_coding_exam(exam, self.student)

		self.assertEqual(
			frappe.db.get_value("CS17 Coding Exam Attempt", {"exam": exam}, "ends_at"),
			add_to_date(ends_at, minutes=20),
		)

	def test_reopening_the_exam_reopens_a_question_finishing_submitted(self):
		exam, question = self.start_exam()
		project = coding_exam.open_exam_question(exam, question)["project"]
		api.save_python_project(project, "print(1)")
		coding_exam.finish_coding_exam(exam)
		frappe.set_user(self.faculty_user)
		coding_exam.reopen_coding_exam(exam, self.student)
		frappe.set_user(self.student_user)

		self.assertEqual(coding_exam.get_my_coding_exam(exam)["questions"][0].state, "in_progress")

	def test_reopening_the_exam_keeps_a_question_submitted_before_finishing(self):
		exam, question = self.start_exam()
		project = coding_exam.open_exam_question(exam, question)["project"]
		api.save_python_project(project, "print(1)")
		api.submit_python_project(question, project)
		coding_exam.finish_coding_exam(exam)
		frappe.set_user(self.faculty_user)
		coding_exam.reopen_coding_exam(exam, self.student)
		frappe.set_user(self.student_user)

		self.assertEqual(coding_exam.get_my_coding_exam(exam)["questions"][0].state, "submitted")

	def test_reopening_the_exam_past_the_close_time_is_refused(self):
		exam, _ = self.start_exam()
		coding_exam.finish_coding_exam(exam)
		frappe.set_user(self.faculty_user)
		coding_exam.set_exam_closes_on(exam, from_now(minutes=60))

		self.assertRaisesRegex(
			frappe.ValidationError,
			"^The exam closes at",
			coding_exam.reopen_coding_exam,
			exam,
			self.student,
		)

	def test_reopening_the_exam_with_no_time_left_is_refused(self):
		exam, _ = self.start_exam()
		frappe.db.set_value(
			"CS17 Coding Exam Attempt",
			{"exam": exam},
			{"started_at": from_now(minutes=-121), "ends_at": from_now(minutes=-1)},
		)
		frappe.set_user("Administrator")
		tasks.submit_saved_work_when_time_is_up()
		frappe.set_user(self.faculty_user)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"^Aarav Sharma had no time left",
			coding_exam.reopen_coding_exam,
			exam,
			self.student,
		)

	def test_the_time_up_job_leaves_an_exam_reopened_with_extra_minutes_running(self):
		exam, _ = self.start_exam()
		frappe.db.set_value(
			"CS17 Coding Exam Attempt",
			{"exam": exam},
			{"started_at": from_now(minutes=-121), "ends_at": from_now(minutes=-1)},
		)
		frappe.set_user("Administrator")
		tasks.submit_saved_work_when_time_is_up()
		frappe.set_user(self.faculty_user)
		coding_exam.reopen_coding_exam(exam, self.student, 10)
		frappe.set_user("Administrator")
		tasks.submit_saved_work_when_time_is_up()

		self.assertFalse(frappe.db.get_value("CS17 Coding Exam Attempt", {"exam": exam}, "finished_on"))

	def test_finishing_again_submits_a_reopened_question_with_no_edits(self):
		exam, question = self.start_exam()
		project = coding_exam.open_exam_question(exam, question)["project"]
		api.save_python_project(project, "print(1)")
		coding_exam.finish_coding_exam(exam)
		frappe.set_user(self.faculty_user)
		coding_exam.reopen_coding_exam(exam, self.student)
		frappe.set_user(self.student_user)
		coding_exam.finish_coding_exam(exam)

		self.assertEqual(coding_exam.get_my_coding_exam(exam)["questions"][0].state, "submitted")

	def test_seconds_away_submit_the_exam(self):
		exam, _ = self.start_exam(leave_seconds=60, leave_action="Submit exam")
		exam_activity.record_exam_event(exam, "tab_leave")
		exam_activity.record_exam_event(exam, "tab_leave", seconds=75)

		self.assertTrue(coding_exam.get_my_coding_exam(exam)["attempt"]["finished_on"])

	def test_a_window_blur_counts_only_when_window_switches_count(self):
		exam, _ = self.start_exam(leave_limit=1)
		exam_activity.record_exam_event(exam, "window_blur")

		self.assertFalse(self.events(exam, "rule_action"))

	def test_many_lines_in_one_save_are_a_code_jump(self):
		exam, question = self.start_exam(paste_rule="Log")
		project = coding_exam.open_exam_question(exam, question)["project"]
		api.save_python_project(project, "print(1)")
		api.save_python_project(project, LONG_CODE)

		self.assertEqual([event.detail for event in self.events(exam, "code_jump")], ["19 lines"])

	def test_a_paste_before_the_save_is_not_a_code_jump(self):
		exam, question = self.start_exam(paste_rule="Log")
		project = coding_exam.open_exam_question(exam, question)["project"]
		api.save_python_project(project, "print(1)")
		exam_activity.record_exam_event(exam, "paste", question, detail="20 lines")
		api.save_python_project(project, LONG_CODE)

		self.assertFalse(self.events(exam, "code_jump"))

	def test_another_session_is_a_second_login(self):
		exam, _ = self.start_exam()
		sessions = frappe.qb.DocType("Sessions")
		frappe.qb.into(sessions).columns(
			sessions.sid, sessions.user, sessions.lastupdate, sessions.status
		).insert(hash_sid("phone-session"), self.student_user, now(), "Active").run()
		coding_exam.get_my_coding_exam(exam)
		coding_exam.get_my_coding_exam(exam)

		self.assertEqual(len(self.events(exam, "second_login")), 1)

	def test_the_student_gets_the_exam_rules(self):
		exam, _ = self.start_exam(require_fullscreen=1, paste_rule="Block outside code")

		self.assertEqual(
			coding_exam.get_my_coding_exam(exam)["rules"],
			{
				"require_fullscreen": 1,
				"count_window_switches": 0,
				"paste_rule": "Block outside code",
				"watch_copy": 0,
			},
		)

	def test_saving_the_exam_without_rules_keeps_them(self):
		exam, question = self.start_exam(require_fullscreen=1)
		frappe.set_user(self.faculty_user)
		coding_exam.save_coding_exam(
			exam=exam,
			title="Python midterm",
			cohort=self.cohort,
			duration_minutes=150,
			opens_on=from_now(minutes=-10),
			last_start_on=from_now(minutes=30),
			closes_on=from_now(hours=3),
			question_order="Any order",
			questions=[{"assignment": question, "marks": 10}],
			is_published=1,
		)

		self.assertEqual(frappe.db.get_value("CS17 Coding Exam", exam, "require_fullscreen"), 1)

	def test_an_unknown_alert_kind_is_refused(self):
		self.assertRaisesRegex(
			frappe.ValidationError,
			"^tab_switch is not a kind of exam alert",
			self.start_exam,
			alert_kinds="tab_leave\ntab_switch",
		)
