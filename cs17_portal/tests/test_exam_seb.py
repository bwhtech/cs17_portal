# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime, set_request, sha256_hash

from cs17_portal import api, coding_exam
from cs17_portal.exam_seb import SafeExamBrowserRequiredError
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user

WINDOWS_KEY = "4c5e2b9a7f1d3e8c6b0a9d2f5e7c1b3a8d6f4e2c0b9a7d5f3e1c8b6a4d2f0e9c"
MAC_KEY = "9b1e7d3f5a2c8e0b6d4f1a3c5e7b9d2f4a6c8e0b1d3f5a7c9e2b4d6f8a0c1e3d"


def from_now(**kwargs) -> str:
	return str(add_to_date(now_datetime(), **kwargs))


class TestExamSeb(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C850TEST")
		cls.faculty_user = make_user("faculty850@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student850@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.question = api.create_assignment(
			"Loops practice",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			test_cases=frappe.as_json([{"input": "3\n", "expected_output": "9\n", "is_hidden": 0}]),
		)
		self.exam = coding_exam.save_coding_exam(
			title="Python midterm",
			cohort=self.cohort,
			duration_minutes=120,
			opens_on=from_now(minutes=-10),
			last_start_on=from_now(minutes=30),
			closes_on=from_now(hours=3),
			question_order="Any order",
			questions=[{"assignment": self.question, "marks": 10}],
			is_published=1,
		)
		frappe.set_user("Administrator")
		exam_doc = frappe.get_doc("CS17 Coding Exam", self.exam)
		exam_doc.update({"require_seb": 1, "seb_browser_exam_key": f"{WINDOWS_KEY} {MAC_KEY}"})
		exam_doc.save()
		frappe.set_user(self.student_user)

	def send_request(self, method: str, query: str = "", key: str | None = None) -> None:
		path = f"/api/v2/method/cs17_portal.{method}"
		url = f"http://localhost{path}" + (f"?{query}" if query else "")
		headers = {"X-SafeExamBrowser-RequestHash": sha256_hash(url + key)} if key else {}
		self.addCleanup(delattr, frappe.local, "request")
		set_request(path=path, query_string=query, headers=headers)

	def test_a_request_hash_from_any_key_opens_the_exam(self):
		self.send_request("coding_exam.get_my_coding_exam", f"exam={self.exam}", MAC_KEY)

		self.assertEqual(coding_exam.get_my_coding_exam(self.exam)["name"], self.exam)

	def test_a_request_hash_from_another_key_is_refused(self):
		self.send_request("coding_exam.get_my_coding_exam", f"exam={self.exam}", "0" * 64)

		self.assertRaises(SafeExamBrowserRequiredError, coding_exam.get_my_coding_exam, self.exam)

	def test_a_request_without_the_hash_is_refused(self):
		self.send_request("coding_exam.get_my_coding_exam", f"exam={self.exam}")

		self.assertRaises(SafeExamBrowserRequiredError, coding_exam.get_my_coding_exam, self.exam)

	def test_an_exam_without_safe_exam_browser_needs_no_hash(self):
		frappe.db.set_value("CS17 Coding Exam", self.exam, "require_seb", 0)

		self.assertEqual(coding_exam.get_my_coding_exam(self.exam)["name"], self.exam)

	def test_a_save_without_the_hash_is_refused(self):
		frappe.db.set_value("CS17 Coding Exam", self.exam, "require_seb", 0)
		coding_exam.start_coding_exam(self.exam)
		project = coding_exam.open_exam_question(self.exam, self.question)["project"]
		frappe.db.set_value("CS17 Coding Exam", self.exam, "require_seb", 1)
		self.send_request("api.save_python_project")

		self.assertRaises(SafeExamBrowserRequiredError, api.save_python_project, project, "print(9)")
