from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from cs17_portal.tasks import auto_publish_results
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


class IntegrationTestCS17Result(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C120TEST")
		cls.student = make_profile("Student", cls.cohort, make_user("student120@cs17test.com"), "Student 120")
		cls.subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS120", "subject_name": "Maths 120"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		cls.scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 120",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	def setUp(self):
		super().setUp()
		self.log_error = self.enterContext(patch.object(frappe, "log_error"))
		exam = (
			frappe.get_doc(
				{
					"doctype": "CS17 Exam",
					"exam_name": "Quarter Exam 120",
					"cohort": self.cohort,
					"grading_scale": self.scale,
					"subjects": [{"subject": self.subject}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		self.marks = (
			frappe.get_doc(
				{
					"doctype": "CS17 Subject Marks",
					"exam": exam,
					"student": self.student,
					"subject": self.subject,
					"components": [{"component": "Total", "marks_obtained": 82}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		self.result = (
			frappe.get_doc(
				{
					"doctype": "CS17 Result",
					"exam": exam,
					"student": self.student,
					"published_on": "2000-01-01 00:00:00",
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	def test_due_result_with_marks_missing_stays_unpublished(self):
		frappe.delete_doc("CS17 Subject Marks", self.marks)

		auto_publish_results()

		self.assertEqual(frappe.db.get_value("CS17 Result", self.result, "is_published"), 0)

	def test_due_result_with_marks_missing_is_logged_once(self):
		frappe.delete_doc("CS17 Subject Marks", self.marks)

		auto_publish_results()
		with patch.object(frappe.db, "exists", return_value=True):
			auto_publish_results()

		logged = [call.kwargs["reference_name"] for call in self.log_error.call_args_list]
		self.assertEqual(logged.count(self.result), 1)

	def test_due_result_with_all_marks_is_published(self):
		auto_publish_results()

		self.assertEqual(frappe.db.get_value("CS17 Result", self.result, "is_published"), 1)
