# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import get_datetime, get_url

from cs17_portal import api
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import notify_students
from cs17_portal.tasks import auto_publish_assignments, remind_due_assignments
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestStudentNotifications(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C330TEST")
		cls.faculty_user = make_user("faculty330@cs17test.com")
		cls.student_330_user = make_user("student330@cs17test.com")
		cls.student_331_user = make_user("student331@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 330")
		cls.student_330 = make_profile("Student", cls.cohort, cls.student_330_user, "Student 330")
		cls.student_331 = make_profile("Student", cls.cohort, cls.student_331_user, "Student 331")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)

	def test_handing_out_a_published_assignment_notifies_only_the_students_added(self):
		assignment = make_assignment(self.cohort, "PDF Task 330", "PDF", 0)
		api.set_assignment_students(assignment, [self.student_330])

		with patch.object(frappe, "enqueue") as enqueue:
			api.set_assignment_students(assignment, [self.student_330, self.student_331])

		enqueue.assert_called_once_with(
			notify_students,
			assignment=assignment,
			students=[self.student_331],
			subject="New assignment: PDF Task 330",
			enqueue_after_commit=True,
		)

	def test_scheduled_publish_notifies_the_cohort(self):
		assignment = make_assignment(self.cohort, "PDF Task 331", "PDF", 0)
		frappe.db.set_value(
			"CS17 Assignment", assignment, {"is_published": 0, "publish_on": "2000-01-01 00:00:00"}
		)

		with patch.object(frappe, "enqueue") as enqueue:
			auto_publish_assignments()

		enqueue.assert_any_call(
			notify_students,
			assignment=assignment,
			students=sorted([self.student_330, self.student_331]),
			subject="New assignment: PDF Task 331",
			enqueue_after_commit=True,
		)

	def test_publishing_a_grade_notifies_its_student(self):
		assignment = make_assignment(self.cohort, "PDF Task 332", "PDF", 20)
		submission = make_submission(assignment, self.student_330, "Student 330", "PDF Task 332")

		with patch.object(frappe, "enqueue") as enqueue:
			api.grade_submission(submission, grade="A", publish="now")

		enqueue.assert_called_once_with(
			notify_students,
			assignment=assignment,
			students=[self.student_330],
			subject="Graded: PDF Task 332",
			enqueue_after_commit=True,
		)

	def test_student_is_notified_in_the_bell_and_by_email(self):
		assignment = make_assignment(self.cohort, "PDF Task 333", "PDF", 0)

		with patch.object(frappe, "sendmail") as sendmail:
			notify_students(assignment, [self.student_330], "New assignment: PDF Task 333")

		self.assertTrue(
			frappe.db.exists(
				"Notification Log", {"for_user": self.student_330_user, "document_name": assignment}
			)
		)
		sendmail.assert_called_once_with(
			recipients=[self.student_330_user],
			subject="New assignment: PDF Task 333",
			template="new_notification",
			args={
				"body_content": "New assignment: PDF Task 333",
				"doc_link": get_url(f"/dashboard/assignments/{assignment}/submission"),
			},
		)

	def test_student_who_turned_email_off_is_not_emailed(self):
		assignment = make_assignment(self.cohort, "PDF Task 334", "PDF", 0)
		frappe.db.set_value("Notification Settings", self.student_330_user, "enable_email_notifications", 0)
		self.addCleanup(
			frappe.db.set_value,
			"Notification Settings",
			self.student_330_user,
			"enable_email_notifications",
			1,
		)

		with patch.object(frappe, "sendmail") as sendmail:
			notify_students(assignment, [self.student_330], "New assignment: PDF Task 334")

		sendmail.assert_not_called()

	def test_due_reminder_skips_students_who_submitted(self):
		assignment = make_assignment(self.cohort, "PDF Task 335", "PDF", 0)
		make_submission(assignment, self.student_330, "Student 330", "PDF Task 335")

		with (
			patch("cs17_portal.tasks.now_datetime", return_value=get_datetime("2029-12-31 00:20:00")),
			patch(
				"cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment.notify_students"
			) as notify,
		):
			remind_due_assignments()

		notify.assert_any_call(assignment, [self.student_331], "Due in 24 hours: PDF Task 335")
