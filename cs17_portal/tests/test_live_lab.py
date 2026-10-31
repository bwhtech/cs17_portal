# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from cs17_portal import api, demo, live_lab
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


class TestLiveLab(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C460TEST")
		cls.faculty_user = make_user("faculty460@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student460@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.second_student_user = make_user("student461@cs17test.com")
		cls.second_student = make_profile("Student", cls.cohort, cls.second_student_user, "Diya Patel")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = api.create_assignment(
			"Loops practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)

	def add_second_student_run(self, minutes_ago: int, **fields):
		frappe.get_doc(
			{
				"doctype": "CS17 Code Run",
				"assignment": self.assignment,
				"student": self.second_student,
				"ran_at": add_to_date(now_datetime(), minutes=-minutes_ago),
				**fields,
			}
		).insert(ignore_permissions=True)

	def get_live_lab(self) -> dict:
		frappe.set_user(self.faculty_user)
		return live_lab.get_live_lab(self.assignment)

	def test_a_run_after_a_test_check_keeps_the_test_result(self):
		frappe.set_user(self.student_user)
		project = api.start_python_assignment(self.assignment)["name"]
		live_lab.record_code_run(project, passed=1, total=2)
		live_lab.record_code_run(project, error_type="NameError", error_line=4)

		[row] = [row for row in self.get_live_lab()["students"] if row["full_name"] == "Aarav Sharma"]

		self.assertEqual(
			(row["passed"], row["total"], row["error_type"], row["error_line"]), (1, 2, "NameError", 4)
		)

	def test_a_student_failing_for_five_minutes_comes_first(self):
		self.add_second_student_run(minutes_ago=6, error_type="NameError", error_line=4)

		students = self.get_live_lab()["students"]

		self.assertEqual([row["full_name"] for row in students], ["Diya Patel", "Aarav Sharma"])

	def test_a_student_who_fixed_the_error_is_not_stuck(self):
		self.add_second_student_run(minutes_ago=6, error_type="NameError", error_line=4)
		self.add_second_student_run(minutes_ago=1)

		students = self.get_live_lab()["students"]

		self.assertFalse(any(row["stuck"] for row in students))

	def test_a_student_idle_for_ten_minutes_comes_first(self):
		frappe.set_user(self.second_student_user)
		project = api.start_python_assignment(self.assignment)["name"]
		frappe.db.set_value(
			"CS17 Project", project, "last_saved_at", add_to_date(now_datetime(), minutes=-11)
		)

		students = self.get_live_lab()["students"]

		self.assertEqual([row["full_name"] for row in students], ["Diya Patel", "Aarav Sharma"])

	def test_a_submitted_student_is_not_stuck(self):
		self.add_second_student_run(minutes_ago=11)
		make_submission(self.assignment, self.second_student, "Diya Patel", "Loops practice")

		students = self.get_live_lab()["students"]

		self.assertFalse(any(row["stuck"] for row in students))

	def test_common_errors_count_students_by_error_and_line(self):
		frappe.set_user(self.student_user)
		project = api.start_python_assignment(self.assignment)["name"]
		live_lab.record_code_run(project, error_type="IndentationError", error_line=3)
		self.add_second_student_run(minutes_ago=1, error_type="IndentationError", error_line=3)

		common_errors = self.get_live_lab()["common_errors"]

		self.assertEqual(common_errors, [{"error_type": "IndentationError", "error_line": 3, "students": 2}])

	def test_deleting_the_assignment_deletes_its_runs(self):
		self.add_second_student_run(minutes_ago=1)

		api.delete_assignment(self.assignment)

		self.assertFalse(frappe.db.exists("CS17 Code Run", {"assignment": self.assignment}))


class TestLiveLabDemoWipe(FrappeTestCase):
	def test_wipe_deletes_a_demo_students_code_runs(self):
		cohort = make_cohort("C462TEST")
		student = make_profile("Student", cohort, make_user("student462@demo.cs17test.com"), "Kabir Rao")
		assignment = make_assignment(cohort, "Loops practice", "Python", 20)
		frappe.get_doc({"doctype": "CS17 Code Run", "assignment": assignment, "student": student}).insert(
			ignore_permissions=True
		)

		with (
			patch.multiple(demo, DOMAIN="@demo.cs17test.com", COHORT_NOW=cohort, COHORT_PAST=cohort),
			patch.object(frappe.db, "commit"),
			patch.object(frappe.db, "rollback"),
		):
			demo.wipe()

		self.assertFalse(frappe.db.exists("CS17 Code Run", {"student": student}))
