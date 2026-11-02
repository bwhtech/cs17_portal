# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api, demo, hints, live_lab
from cs17_portal.tests.test_ai_grading import ai_reply, set_ai_settings
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_user

HINT = "What does your program print when the input is 4?"
TEST_RESULTS = [{"passed": True, "output": "9\n"}, {"passed": False, "output": "8\n"}]


class TestHints(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C760TEST")
		cls.faculty_user = make_user("faculty760@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student760@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")

	def setUp(self):
		set_ai_settings("openai/gpt-5", "sk-test")
		self.addCleanup(set_ai_settings, "", "")
		self.addCleanup(frappe.set_user, "Administrator")

	def start_assignment(self, hint_after_failed_runs: int = 1, max_hints: int = 3) -> tuple[str, str]:
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"Squares practice",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			publish="now",
			test_cases=frappe.as_json(
				[
					{"input": "3\n", "expected_output": "9\n", "is_hidden": 0},
					{"input": "4\n", "expected_output": "16\n", "is_hidden": 0},
					{"input": "5\n", "expected_output": "25\n", "is_hidden": 1},
				]
			),
			hint_after_failed_runs=hint_after_failed_runs,
			max_hints=max_hints,
		)
		frappe.set_user(self.student_user)
		project = api.start_python_assignment(assignment)["name"]
		live_lab.record_code_run(project, passed=1, total=2)
		return assignment, project

	def ask_for_hint(self, assignment: str, project: str):
		with patch("litellm.completion", return_value=ai_reply(HINT)) as completion:
			hints.ask_for_hint(assignment, project, "print(int(input()) * 2)", TEST_RESULTS)
		return completion

	def test_a_hint_unlocks_after_the_set_number_of_failed_checks(self):
		assignment, project = self.start_assignment(hint_after_failed_runs=2)
		live_lab.record_code_run(project, passed=0, total=2)

		self.assertTrue(hints.get_hint_state(assignment)["unlocked"])

	def test_hints_stay_off_without_an_ai_model(self):
		assignment, _ = self.start_assignment()
		set_ai_settings("", "")

		self.assertEqual(hints.get_hint_state(assignment), {"enabled": False})

	def test_ask_for_hint_sends_only_the_failing_sample_test(self):
		completion = self.ask_for_hint(*self.start_assignment())

		prompt = completion.call_args.kwargs["messages"][1]["content"].split("\n\n<student_code>")[0]
		self.assertEqual(
			frappe.parse_json(prompt)["failing_examples"],
			[{"input": "4\n", "expected_output": "16\n", "output": "8\n"}],
		)

	def test_ask_for_hint_refuses_once_the_hints_are_used(self):
		assignment, project = self.start_assignment(max_hints=1)
		self.ask_for_hint(assignment, project)

		self.assertRaisesRegex(
			frappe.ValidationError, "^No hint is open", self.ask_for_hint, assignment, project
		)

	def test_ask_for_hint_refuses_a_second_hint_within_30_seconds(self):
		assignment, project = self.start_assignment()
		self.ask_for_hint(assignment, project)

		self.assertRaisesRegex(
			frappe.ValidationError, "^Wait 30 seconds", self.ask_for_hint, assignment, project
		)

	def test_ask_for_hint_refuses_a_project_of_another_assignment(self):
		assignment, _ = self.start_assignment()
		_, other_project = self.start_assignment()

		self.assertRaises(frappe.PermissionError, self.ask_for_hint, assignment, other_project)

	def test_ask_for_hint_refuses_a_closed_assignment(self):
		assignment, project = self.start_assignment()
		frappe.db.set_value("CS17 Assignment", assignment, "due_date", "2026-01-01 00:00:00")

		self.assertRaisesRegex(
			frappe.ValidationError, "^This assignment is closed", self.ask_for_hint, assignment, project
		)

	def test_faculty_sees_the_hints_on_the_submission(self):
		assignment, project = self.start_assignment()
		self.ask_for_hint(assignment, project)
		api.save_python_project(project, "print(int(input()) ** 2)")
		submission = api.submit_python_project(assignment, project)["name"]

		frappe.set_user(self.faculty_user)
		[hint] = hints.get_hints(submission)

		self.assertEqual(hint.hint, HINT)

	def test_deleting_the_assignment_deletes_its_hints(self):
		assignment, project = self.start_assignment()
		self.ask_for_hint(assignment, project)

		frappe.set_user(self.faculty_user)
		api.delete_assignment(assignment)

		self.assertFalse(frappe.db.exists("CS17 Hint", {"assignment": assignment}))

	def test_hints_on_need_at_least_one_hint(self):
		frappe.set_user(self.faculty_user)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"^Allow at least one hint",
			api.create_assignment,
			"Squares practice",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			hint_after_failed_runs=2,
			max_hints=0,
		)

	def test_copy_keeps_the_hint_settings(self):
		assignment, _ = self.start_assignment(hint_after_failed_runs=2, max_hints=5)

		frappe.set_user(self.faculty_user)
		[copy] = api.copy_assignments([assignment], self.cohort)

		self.assertEqual(
			frappe.db.get_value("CS17 Assignment", copy, ["hint_after_failed_runs", "max_hints"]), (2, 5)
		)


class TestHintsDemoWipe(FrappeTestCase):
	def test_wipe_deletes_a_demo_students_hints(self):
		cohort = make_cohort("C761TEST")
		student = make_profile("Student", cohort, make_user("student761@demo.cs17test.com"), "Kabir Rao")
		assignment = make_assignment(cohort, "Squares practice", "Python", 20)
		frappe.get_doc({"doctype": "CS17 Hint", "assignment": assignment, "student": student}).insert(
			ignore_permissions=True
		)

		with (
			patch.multiple(demo, DOMAIN="@demo.cs17test.com", COHORT_NOW=cohort, COHORT_PAST=cohort),
			patch.object(frappe.db, "commit"),
			patch.object(frappe.db, "rollback"),
		):
			demo.wipe()

		self.assertFalse(frappe.db.exists("CS17 Hint", {"student": student}))
