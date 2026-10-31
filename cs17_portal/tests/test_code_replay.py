# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api, code_replay, demo, pastes
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_user

FIRST_TRY = "for number in range(1, 11):\n    print(number)\n"
EVEN_NUMBERS = "for number in range(1, 11):\n    if number % 2 == 0:\n        print(number)\n"


class TestCodeReplay(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C470TEST")
		cls.faculty_user = make_user("faculty470@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student470@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")

	def start_assignment(self) -> tuple[str, str]:
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"Loops practice",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			publish="now",
			watch_tab_switches=1,
		)
		frappe.set_user(self.student_user)
		return assignment, api.start_python_assignment(assignment)["name"]

	def test_faculty_replays_each_change_of_the_code(self):
		assignment, project = self.start_assignment()
		api.save_python_project(project, FIRST_TRY)
		api.save_python_project(project, FIRST_TRY)
		api.save_python_project(project, EVEN_NUMBERS)
		submission = api.submit_python_project(assignment, project)["name"]

		frappe.set_user(self.faculty_user)
		snapshots = code_replay.get_code_snapshots(submission)["snapshots"]

		self.assertEqual([snapshot.code for snapshot in snapshots], [FIRST_TRY, EVEN_NUMBERS])

	def test_replay_has_the_pastes_and_tab_leaves(self):
		assignment, project = self.start_assignment()
		pastes.record_paste(project, EVEN_NUMBERS)
		api.record_tab_leave(project)
		api.save_python_project(project, EVEN_NUMBERS)
		submission = api.submit_python_project(assignment, project)["name"]

		frappe.set_user(self.faculty_user)
		replay = code_replay.get_code_snapshots(submission)

		self.assertEqual([paste.line_count for paste in replay["pastes"]], [3])
		self.assertEqual(len(replay["tab_leaves"]), 1)

	def test_practice_project_keeps_no_snapshots(self):
		frappe.set_user(self.student_user)
		project = api.create_project("Loops practice", project_type="Python")["name"]

		api.save_python_project(project, EVEN_NUMBERS)

		self.assertFalse(frappe.db.exists("CS17 Code Snapshot", {"project": project}))

	def test_student_cannot_read_the_snapshots(self):
		assignment, project = self.start_assignment()
		api.save_python_project(project, EVEN_NUMBERS)
		submission = api.submit_python_project(assignment, project)["name"]

		self.assertRaises(frappe.PermissionError, code_replay.get_code_snapshots, submission)

	def test_deleting_the_project_deletes_its_snapshots(self):
		_, project = self.start_assignment()
		api.save_python_project(project, EVEN_NUMBERS)

		api.delete_project(project)

		self.assertFalse(frappe.db.exists("CS17 Code Snapshot", {"project": project}))

	def test_deleting_the_assignment_deletes_its_snapshots(self):
		assignment, project = self.start_assignment()
		api.save_python_project(project, EVEN_NUMBERS)

		frappe.set_user(self.faculty_user)
		api.delete_assignment(assignment)

		self.assertFalse(frappe.db.exists("CS17 Code Snapshot", {"assignment": assignment}))

	def test_demo_wipe_deletes_a_demo_students_snapshots(self):
		cohort = make_cohort("C934TEST")
		student = make_profile("Student", cohort, make_user("student934@demo.cs17test.com"), "Kabir Rao")
		assignment = make_assignment(cohort, "Loops practice", "Python", 20)
		project = (
			frappe.get_doc(
				{
					"doctype": "CS17 Project",
					"project_title": "Loops practice",
					"project_type": "Python",
					"profile": student,
					"assignment": assignment,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		frappe.get_doc(
			{
				"doctype": "CS17 Code Snapshot",
				"project": project,
				"assignment": assignment,
				"student": student,
				"code": EVEN_NUMBERS,
			}
		).insert(ignore_permissions=True)

		with (
			patch.multiple(demo, DOMAIN="@demo.cs17test.com", COHORT_NOW=cohort, COHORT_PAST=cohort),
			patch.object(frappe.db, "commit"),
			patch.object(frappe.db, "rollback"),
		):
			demo.wipe()

		self.assertFalse(frappe.db.exists("CS17 Code Snapshot", {"student": student}))
