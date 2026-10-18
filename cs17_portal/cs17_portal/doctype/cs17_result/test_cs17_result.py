from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import get_datetime

from cs17_portal import api
from cs17_portal.tasks import auto_publish_results
from cs17_portal.tests.test_api import make_cohort, make_profile, make_submission, make_user


class IntegrationTestCS17Result(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C120TEST")
		cls.student = make_profile("Student", cls.cohort, make_user("student120@cs17test.com"), "Student 120")
		cls.faculty_user = make_user("faculty120@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 120")
		cls.quarter = (
			frappe.get_doc({"doctype": "CS17 Quarter", "quarter_name": "Quarter 120"})
			.insert(ignore_permissions=True)
			.name
		)
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
		log = frappe.get_doc(
			{
				"doctype": "Error Log",
				"method": "Scheduled result not published",
				"reference_doctype": "CS17 Result",
				"reference_name": self.result,
			}
		).insert(ignore_permissions=True)
		self.addCleanup(log.delete)

		auto_publish_results()

		logged = [call.kwargs["reference_name"] for call in self.log_error.call_args_list]
		self.assertNotIn(self.result, logged)

	def test_due_result_with_all_marks_is_published(self):
		auto_publish_results()

		self.assertEqual(frappe.db.get_value("CS17 Result", self.result, "is_published"), 1)

	def test_marks_are_accepted_on_a_scheduled_result_with_marks_missing(self):
		science = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "SCIENCE120", "subject_name": "Science 120"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		marks = frappe.get_doc("CS17 Subject Marks", self.marks)
		exam = frappe.get_doc("CS17 Exam", marks.exam)
		exam.append("subjects", {"subject": science})
		exam.save()

		marks.components[0].marks_obtained = 90
		marks.save()

		self.assertEqual(frappe.db.get_value("CS17 Result", self.result, "total_marks_obtained"), 90)

	def test_scheduling_a_result_with_marks_missing_is_refused(self):
		frappe.delete_doc("CS17 Subject Marks", self.marks)
		result = frappe.get_doc("CS17 Result", self.result)
		result.published_on = "2000-01-02 00:00:00"

		self.assertRaises(frappe.ValidationError, result.save)

	def test_deleted_marks_drop_out_of_the_result(self):
		frappe.delete_doc("CS17 Subject Marks", self.marks)

		self.assertEqual(frappe.db.get_value("CS17 Result", self.result, "total_marks_obtained"), 0)

	def test_marks_of_a_published_result_cannot_be_deleted(self):
		frappe.get_doc("CS17 Result", self.result).publish()

		self.assertRaises(frappe.ValidationError, frappe.delete_doc, "CS17 Subject Marks", self.marks)

	def test_second_result_for_the_same_exam_and_student_is_refused(self):
		exam = frappe.db.get_value("CS17 Result", self.result, "exam")
		second = frappe.get_doc({"doctype": "CS17 Result", "exam": exam, "student": self.student})

		self.assertRaisesRegex(
			frappe.ValidationError, "already exists for this student and exam", second.insert
		)

	def test_exam_and_student_have_a_unique_index(self):
		self.assertTrue(frappe.db.has_index("tabCS17 Result", "unique_exam_student"))

	def test_unpublished_result_is_not_published_again(self):
		auto_publish_results()
		result = frappe.get_doc("CS17 Result", self.result)
		result.is_published = 0
		result.save()

		auto_publish_results()

		self.assertIsNone(result.published_on)
		self.assertEqual(frappe.db.get_value("CS17 Result", self.result, "is_published"), 0)

	def test_unpublishing_with_a_new_time_keeps_the_new_time(self):
		auto_publish_results()
		result = frappe.get_doc("CS17 Result", self.result)
		result.is_published = 0
		result.published_on = "2100-01-01 00:00:00"
		result.save()

		self.assertEqual(
			frappe.db.get_value("CS17 Result", self.result, "published_on"),
			get_datetime("2100-01-01 00:00:00"),
		)

	def test_published_flag_sent_as_text_zero_unpublishes(self):
		auto_publish_results()
		result = frappe.get_doc("CS17 Result", self.result)
		result.is_published = "0"
		result.save()

		self.assertIsNone(frappe.db.get_value("CS17 Result", self.result, "published_on"))

	def make_marks_submission(self) -> tuple[str, str]:
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"PDF Task 120",
			self.cohort,
			"2030-01-01 00:00:00",
			assignment_type="Graded",
			max_marks=12.5,
			remarks="Marks",
			publish="now",
			quarter=self.quarter,
		)
		frappe.set_user("Administrator")
		return assignment, make_submission(assignment, self.student, "Student 120", "PDF Task 120")

	def get_assignment_row(self, assignment: str):
		result = frappe.get_doc("CS17 Result", self.result)
		result.quarter = self.quarter
		result.save()
		return next(row for row in result.assignments if row.assignment == assignment)

	def test_submitted_marks_assignment_without_a_grade_is_not_graded(self):
		assignment, _submission = self.make_marks_submission()

		row = self.get_assignment_row(assignment)

		self.assertEqual((row.is_submitted, row.is_graded, row.marks_obtained), (1, 0, 0))

	def test_marks_assignment_graded_zero_is_graded(self):
		assignment, submission = self.make_marks_submission()
		frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": assignment,
				"submission": submission,
				"marks_obtained": 0,
			}
		).insert(ignore_permissions=True)

		row = self.get_assignment_row(assignment)

		self.assertEqual((row.is_graded, row.marks_obtained), (1, 0))

	def test_graded_marks_assignment_carries_its_letter(self):
		assignment, submission = self.make_marks_submission()
		grade = frappe.get_doc(
			{
				"doctype": "CS17 Assignment Grade",
				"assignment": assignment,
				"submission": submission,
				"marks_obtained": 10,
			}
		).insert(ignore_permissions=True)
		frappe.db.set_value("CS17 Assignment Grade", grade.name, "grade", "B")

		row = self.get_assignment_row(assignment)

		self.assertEqual(row.grade, "B")
