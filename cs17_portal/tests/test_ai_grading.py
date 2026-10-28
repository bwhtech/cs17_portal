# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from types import SimpleNamespace
from unittest.mock import patch

import frappe
import litellm
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


def set_ai_settings(model: str, api_key: str) -> None:
	settings = frappe.get_doc("CS17 AI Settings")
	settings.model = model
	settings.api_key = api_key
	settings.save(ignore_permissions=True)


def ai_reply(content: str) -> SimpleNamespace:
	return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


class TestCheckSubmission(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cohort = make_cohort("C180TEST")
		cls.faculty_user = make_user("faculty180@cs17test.com")
		make_profile("Faculty", cohort, cls.faculty_user, "Faculty 180")
		cls.student_user = make_user("student180@cs17test.com")
		student = make_profile("Student", cohort, cls.student_user, "Student 180")

		cls.marks_assignment = make_assignment(cohort, "Python Task 180", "Python", 20)
		frappe.db.set_value("CS17 Assignment", cls.marks_assignment, "remarks", "Marks")
		cls.submission = make_submission(cls.marks_assignment, student, "Student 180", "Python Task 180")

		grade_assignment = make_assignment(cohort, "Python Task 181", "Python", 20)
		frappe.db.set_value("CS17 Assignment", grade_assignment, "remarks", "Grade")
		cls.graded_submission = make_submission(grade_assignment, student, "Student 180", "Python Task 181")

	def setUp(self):
		set_ai_settings("openai/gpt-5", "sk-test")
		self.addCleanup(set_ai_settings, "", "")
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_get_assignment_submissions_says_a_python_assignment_can_be_checked_with_ai(self):
		assignment = api.get_assignment_submissions(self.marks_assignment)["assignment"]

		self.assertTrue(assignment.can_check_with_ai)

	def test_check_submission_keeps_the_marks_within_the_maximum(self):
		with patch("litellm.completion", return_value=ai_reply('{"marks_obtained": 25, "remarks": "Good"}')):
			self.assertEqual(api.check_submission(self.submission)["marks_obtained"], 20)

	def test_check_submission_drops_a_grade_outside_the_letter_grades(self):
		with patch("litellm.completion", return_value=ai_reply('{"grade": "A+", "remarks": "Good"}')):
			self.assertIsNone(api.check_submission(self.graded_submission)["grade"])

	def test_check_submission_keeps_a_letter_grade_when_the_grading_scale_uses_other_letters(self):
		with (
			patch("cs17_portal.api.get_grade_bands", return_value=[{"grade": "B1", "min_percent": 0}]),
			patch("litellm.completion", return_value=ai_reply('{"grade": "B", "remarks": "Good"}')),
		):
			self.assertEqual(api.check_submission(self.graded_submission)["grade"], "B")

	def test_check_submission_leaves_the_student_out_of_the_prompt(self):
		with patch("litellm.completion", return_value=ai_reply("{}")) as completion:
			api.check_submission(self.submission)

		prompt = frappe.as_json(completion.call_args.kwargs["messages"])
		self.assertNotIn("Student 180", prompt)
		self.assertNotIn(self.student_user, prompt)

	def test_check_submission_saves_no_grade(self):
		with patch("litellm.completion", return_value=ai_reply('{"marks_obtained": 15, "remarks": "Good"}')):
			api.check_submission(self.submission)

		self.assertFalse(frappe.db.exists("CS17 Assignment Grade", {"submission": self.submission}))

	def test_check_submission_refuses_before_a_model_and_key_are_set(self):
		set_ai_settings("", "")
		with patch("litellm.completion") as completion:
			self.assertRaises(frappe.ValidationError, api.check_submission, self.submission)

		completion.assert_not_called()

	def test_check_submission_turns_a_provider_error_into_a_plain_message(self):
		with (
			patch(
				"litellm.completion", side_effect=Exception("litellm.AuthenticationError: invalid x-api-key")
			),
			patch.object(frappe, "log_error"),
		):
			self.assertRaisesRegex(
				frappe.ValidationError, "^The AI model did not answer", api.check_submission, self.submission
			)

	def test_check_submission_says_a_busy_provider_is_busy(self):
		busy = litellm.ServiceUnavailableError(
			message="This model is currently experiencing high demand", llm_provider="gemini", model="gemini"
		)
		with patch("litellm.completion", side_effect=busy), patch.object(frappe, "log_error"):
			self.assertRaisesRegex(
				frappe.ValidationError, "^The AI model is busy", api.check_submission, self.submission
			)


class TestAISettings(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.manager = make_user("manager180@cs17test.com")
		frappe.get_doc("User", cls.manager).add_roles("System Manager")

	def setUp(self):
		self.addCleanup(set_ai_settings, "", "")
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.manager)

	def test_save_ai_settings_keeps_the_stored_key_when_left_blank(self):
		api.save_ai_settings("openai/gpt-5", "sk-first")
		api.save_ai_settings("anthropic/claude-opus-5-5")

		self.assertEqual(frappe.get_doc("CS17 AI Settings").get_password("api_key"), "sk-first")

	def test_get_ai_settings_says_a_key_is_stored_without_returning_it(self):
		api.save_ai_settings("openai/gpt-5", "sk-first")

		self.assertEqual(api.get_ai_settings(), {"model": "openai/gpt-5", "has_api_key": True})

	def test_get_ai_settings_refuses_a_user_who_is_not_a_system_manager(self):
		frappe.set_user(make_user("faculty181@cs17test.com"))

		self.assertRaises(frappe.PermissionError, api.get_ai_settings)
