# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import demo, explanations
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import notify_students
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user

VOICE_NOTE = "data:audio/webm;codecs=opus;base64,R0tFQkE="


class TestExplanations(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C764TEST")
		cls.faculty_user = make_user("faculty764@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Kavita Rao")
		cls.student_user = make_user("student764@cs17test.com")
		cls.other_student_user = make_user("student765@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		make_profile("Student", cls.cohort, cls.other_student_user, "Diya Menon")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = make_assignment(self.cohort, "Loops practice", "Python", 20)
		self.submission = make_submission(self.assignment, self.student, "Aarav Sharma", "Loops practice")

	def ask(self) -> str:
		frappe.set_user(self.faculty_user)
		with patch.object(frappe, "enqueue"):
			explanations.request_explanation(self.submission, "Why does the loop start at 1?")
		return frappe.db.get_value("CS17 Explanation Request", {"submission": self.submission})

	def test_asking_to_explain_notifies_the_student(self):
		with patch.object(frappe, "enqueue") as enqueue:
			explanations.request_explanation(self.submission)

		enqueue.assert_called_once_with(
			notify_students,
			assignment=self.assignment,
			students=[self.student],
			subject="Explain your code: Loops practice",
			enqueue_after_commit=True,
		)

	def test_a_second_open_request_is_refused(self):
		self.ask()

		self.assertRaisesRegex(
			frappe.ValidationError,
			"An explanation is already requested.",
			explanations.request_explanation,
			self.submission,
		)

	def test_faculty_can_ask_again_once_the_student_answered(self):
		request = self.ask()
		frappe.set_user(self.student_user)
		explanations.answer_explanation_request(request, VOICE_NOTE)

		self.ask()

		self.assertEqual(frappe.db.count("CS17 Explanation Request", {"submission": self.submission}), 2)

	def test_the_voice_note_is_stored_as_a_private_file_on_the_request(self):
		request = self.ask()
		frappe.set_user(self.student_user)
		explanations.answer_explanation_request(request, VOICE_NOTE)

		file = frappe.get_doc(
			"File", {"file_url": frappe.db.get_value("CS17 Explanation Request", request, "voice_note")}
		)
		self.assertEqual(
			(file.is_private, file.attached_to_doctype, file.attached_to_name, file.attached_to_field),
			(1, "CS17 Explanation Request", request, "voice_note"),
		)

	def test_faculty_hears_the_students_voice_note(self):
		request = self.ask()
		frappe.set_user(self.student_user)
		explanations.answer_explanation_request(request, VOICE_NOTE)

		frappe.set_user(self.faculty_user)
		answer = explanations.get_explanation_request(self.submission)

		self.assertEqual(answer.voice_note, "data:audio/webm;base64,R0tFQkE=")

	def test_another_student_cannot_answer(self):
		request = self.ask()

		frappe.set_user(self.other_student_user)
		self.assertRaises(
			frappe.DoesNotExistError, explanations.answer_explanation_request, request, VOICE_NOTE
		)

	def test_an_answered_request_cannot_be_answered_again(self):
		request = self.ask()
		frappe.set_user(self.student_user)
		explanations.answer_explanation_request(request, VOICE_NOTE)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"You already sent your explanation.",
			explanations.answer_explanation_request,
			request,
			VOICE_NOTE,
		)

	def test_only_the_student_who_owns_the_submission_reads_the_request(self):
		self.ask()

		frappe.set_user(self.student_user)
		self.assertEqual(
			explanations.get_my_explanation_request(self.submission).question,
			"Why does the loop start at 1?",
		)
		frappe.set_user(self.other_student_user)
		self.assertRaises(frappe.DoesNotExistError, explanations.get_my_explanation_request, self.submission)

	def test_wipe_deletes_explanation_requests_on_a_demo_students_submission(self):
		cohort = make_cohort("C766TEST")
		student = make_profile("Student", cohort, make_user("student766@demo.cs17test.com"), "Kabir Rao")
		assignment = make_assignment(cohort, "Loops practice", "Python", 20)
		submission = make_submission(assignment, student, "Kabir Rao", "Loops practice")
		request = (
			frappe.get_doc({"doctype": "CS17 Explanation Request", "submission": submission})
			.insert(ignore_permissions=True)
			.name
		)

		with (
			patch.multiple(demo, DOMAIN="@demo.cs17test.com", COHORT_NOW=cohort, COHORT_PAST=cohort),
			patch.object(frappe.db, "commit"),
			patch.object(frappe.db, "rollback"),
		):
			demo.wipe()

		self.assertFalse(frappe.db.exists("CS17 Explanation Request", request))
