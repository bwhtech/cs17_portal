# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from cs17_portal import api, gallery, guardian
from cs17_portal.tasks import send_guardian_digest
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user


def digest_sent_to(user: str) -> dict | None:
	with patch.object(frappe, "sendmail") as sendmail:
		send_guardian_digest()
	return next(
		(call.kwargs["args"] for call in sendmail.call_args_list if call.kwargs["recipients"] == [user]),
		None,
	)


class TestGuardian(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C1390TEST")
		cls.faculty_user = make_user("faculty1390@cs17test.com")
		cls.other_faculty_user = make_user("faculty1391@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		make_profile("Faculty", make_cohort("C1391TEST"), cls.other_faculty_user, "Rohan Gupta")
		cls.student_user = make_user("student1390@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.classmate = make_profile(
			"Student", cls.cohort, make_user("student1391@cs17test.com"), "Diya Patel"
		)
		cls.guardian_user = make_user("guardian1390@cs17test.com")
		cls.guardian = (
			frappe.get_doc(
				{
					"doctype": "CS17 Profile",
					"profile_type": "Guardian",
					"first_name": "Priya",
					"last_name": "Sharma",
					"user": cls.guardian_user,
					"students": [{"student": cls.student}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

		frappe.set_user(cls.faculty_user)
		now = now_datetime()
		for title, marks, publish in (("Loops practice", 15, "now"), ("Lists quiz", 5, None)):
			assignment = make_assignment(cls.cohort, title, "PDF", 20)
			frappe.db.set_value(
				"CS17 Assignment", assignment, {"assignment_type": "Graded", "remarks": "Marks"}
			)
			api.grade_submission(
				make_submission(assignment, cls.student, "Aarav Sharma", title),
				marks_obtained=marks,
				publish=publish,
			)
		for title, days in (("Functions homework", -2), ("Strings worksheet", 3)):
			frappe.db.set_value(
				"CS17 Assignment",
				make_assignment(cls.cohort, title, "PDF", 20),
				"due_date",
				add_to_date(now, days=days),
			)
		frappe.set_user("Administrator")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.guardian_user)

	def test_guardian_sees_due_missing_and_graded_work(self):
		child = guardian.get_my_children()[0]

		self.assertEqual(
			[[row.title for row in child[key]] for key in ("due", "missing", "graded")],
			[["Strings worksheet"], ["Functions homework"], ["Loops practice"]],
		)

	def test_average_counts_published_marks_only(self):
		self.assertEqual(guardian.get_my_children()[0].average, 75.0)

	def test_child_overview_hides_unpublished_grades(self):
		assignments = guardian.get_child_overview(self.student)["assignments"]

		self.assertIsNone(next(row for row in assignments if row.title == "Lists quiz").grade)

	def test_refuses_a_student_who_is_not_their_child(self):
		self.assertRaises(frappe.PermissionError, guardian.get_child_overview, self.classmate)

	def test_student_methods_refuse_a_guardian(self):
		project = (
			frappe.get_doc(
				{
					"doctype": "CS17 Project",
					"project_title": "Loops practice",
					"project_type": "Python",
					"profile": self.student,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

		self.assertRaises(frappe.PermissionError, api.get_student_assignments)
		self.assertRaises(frappe.PermissionError, api.save_python_project, project, "print('hi')")
		self.assertRaises(frappe.PermissionError, api.submit_feedback, "Stay", "Fan is broken")

	def test_guardian_cannot_create_a_project(self):
		self.assertRaises(frappe.PermissionError, api.create_project, "Loops practice")

	def test_gallery_refuses_a_guardian(self):
		self.assertRaises(frappe.PermissionError, gallery.get_shared_projects)

	def test_faculty_sees_the_student_guardians(self):
		frappe.set_user(self.faculty_user)

		self.assertEqual(
			guardian.get_student_guardians(self.student),
			[{"name": self.guardian, "full_name": "Priya Sharma", "email": self.guardian_user}],
		)

	def test_faculty_adds_a_new_guardian_who_gets_a_welcome_email(self):
		frappe.set_user(self.faculty_user)

		with patch.object(frappe, "sendmail") as sendmail:
			guardian.add_guardian(self.classmate, "Kavita Patel", "guardian1391@cs17test.com")

		profile = frappe.get_doc("CS17 Profile", {"user": "guardian1391@cs17test.com"})
		self.assertEqual(
			(profile.profile_type, [row.student for row in profile.students]), ("Guardian", [self.classmate])
		)
		self.assertEqual(sendmail.call_args.kwargs["recipients"], "guardian1391@cs17test.com")

	def test_adding_a_guardian_again_links_another_child(self):
		frappe.set_user(self.faculty_user)

		guardian.add_guardian(self.classmate, "Priya Sharma", self.guardian_user)
		self.addCleanup(guardian.remove_guardian, self.classmate, self.guardian)

		self.assertEqual(
			[row.student for row in frappe.get_doc("CS17 Profile", self.guardian).students],
			[self.student, self.classmate],
		)

	def test_a_student_cannot_be_made_a_guardian(self):
		frappe.set_user(self.faculty_user)

		self.assertRaises(
			frappe.ValidationError, guardian.add_guardian, self.classmate, "Aarav Sharma", self.student_user
		)

	def test_faculty_removes_a_guardian(self):
		frappe.set_user(self.faculty_user)

		guardian.remove_guardian(self.student, self.guardian)
		self.addCleanup(guardian.add_guardian, self.student, "Priya Sharma", self.guardian_user)

		self.assertEqual(frappe.get_doc("CS17 Profile", self.guardian).students, [])

	def test_refuses_faculty_of_another_cohort(self):
		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, guardian.get_student_guardians, self.student)

	def test_weekly_email_lists_each_child_work(self):
		child = digest_sent_to(self.guardian_user)["children"][0]

		self.assertEqual(
			[[row.title for row in child[key]] for key in ("due", "missing", "graded")],
			[["Strings worksheet"], ["Functions homework"], ["Loops practice"]],
		)

	def test_weekly_email_skips_a_guardian_who_turned_email_off(self):
		frappe.db.set_value("Notification Settings", self.guardian_user, "enable_email_notifications", 0)
		self.addCleanup(
			frappe.db.set_value, "Notification Settings", self.guardian_user, "enable_email_notifications", 1
		)

		self.assertIsNone(digest_sent_to(self.guardian_user))

	def test_weekly_email_skips_a_guardian_with_nothing_to_report(self):
		quiet_guardian_user = make_user("guardian1392@cs17test.com")
		frappe.get_doc(
			{
				"doctype": "CS17 Profile",
				"profile_type": "Guardian",
				"first_name": "Kavita",
				"last_name": "Rao",
				"user": quiet_guardian_user,
				"students": [
					{
						"student": make_profile(
							"Student", "C1391TEST", make_user("student1392@cs17test.com"), "Ishaan Rao"
						)
					}
				],
			}
		).insert(ignore_permissions=True)

		self.assertIsNone(digest_sent_to(quiet_guardian_user))
