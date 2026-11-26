# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tasks import send_daily_activity_email
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user


def email_sent_to(user: str) -> dict | None:
	with patch.object(frappe, "sendmail") as sendmail:
		send_daily_activity_email()
	return next(
		(call.kwargs["args"] for call in sendmail.call_args_list if call.kwargs["recipients"] == [user]),
		None,
	)


class TestDailyActivityEmail(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C640TEST")
		cls.faculty_user = make_user("faculty640@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student640@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		make_profile("Student", cls.cohort, make_user("student641@cs17test.com"), "Diya Patel")
		cls.other_cohort = make_cohort("C641TEST")
		cls.other_faculty_user = make_user("faculty641@cs17test.com")
		make_profile("Faculty", cls.other_cohort, cls.other_faculty_user, "Rohan Mehta")
		cls.idle_faculty_user = make_user("faculty643@cs17test.com")
		make_profile("Faculty", make_cohort("C642TEST"), cls.idle_faculty_user, "Neha Kulkarni")
		cls.faculty_without_cohort_user = make_user("faculty642@cs17test.com")
		make_profile("Faculty", None, cls.faculty_without_cohort_user, "Kavita Rao")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Loops practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)
		frappe.set_user(self.student_user)
		api.start_python_assignment(self.assignment)

	def cohort_sent_to(self, user: str) -> frappe._dict | None:
		args = email_sent_to(user)
		return args and next((row for row in args["cohorts"] if row.cohort == self.cohort), None)

	def test_names_students_with_no_work_apart_from_those_who_worked(self):
		cohort = self.cohort_sent_to(self.faculty_user)

		self.assertEqual(cohort.no_work, ["Diya Patel"])
		self.assertEqual([row["full_name"] for row in cohort.worked], ["Aarav Sharma"])

	def test_faculty_without_a_cohort_gets_every_cohort(self):
		self.assertIsNotNone(self.cohort_sent_to(self.faculty_without_cohort_user))

	def test_leaves_out_another_cohort(self):
		frappe.set_user(self.other_faculty_user)
		api.create_assignment(
			"Strings practice",
			self.other_cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			publish="now",
		)

		self.assertEqual(
			[row.cohort for row in email_sent_to(self.other_faculty_user)["cohorts"]], [self.other_cohort]
		)

	def test_cohort_with_nothing_open_and_no_work_is_not_emailed(self):
		self.assertIsNone(email_sent_to(self.idle_faculty_user))

	def test_turning_the_setting_off_sends_nothing(self):
		settings = frappe.get_doc({"doctype": "CS17 Portal Settings", "daily_activity_email": 0}).insert(
			ignore_permissions=True
		)
		self.addCleanup(settings.delete, ignore_permissions=True)

		self.assertIsNone(email_sent_to(self.faculty_user))
