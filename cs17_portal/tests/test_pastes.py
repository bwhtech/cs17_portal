# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api, pastes
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user

EVEN_NUMBERS = "for number in range(1, 11):\n    if number % 2 == 0:\n        print(number)\n"


class TestPastes(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C450TEST")
		cls.faculty_user = make_user("faculty450@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student450@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")

	def start_assignment(self, watch_tab_switches: int) -> tuple[str, str]:
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"Loops practice",
			self.cohort,
			"2030-01-01 00:00:00",
			submission_type="Python",
			publish="now",
			watch_tab_switches=watch_tab_switches,
		)
		frappe.set_user(self.student_user)
		return assignment, api.start_python_assignment(assignment)["name"]

	def test_faculty_sees_a_paste_on_the_submission(self):
		assignment, project = self.start_assignment(watch_tab_switches=1)
		pastes.record_paste(project, EVEN_NUMBERS)
		api.save_python_project(project, EVEN_NUMBERS)
		submission = api.submit_python_project(assignment, project)["name"]

		frappe.set_user(self.faculty_user)
		[paste] = pastes.get_pastes(submission)

		self.assertEqual((paste.line_count, paste.text), (3, EVEN_NUMBERS))

	def test_paste_is_refused_when_the_assignment_does_not_watch(self):
		_, project = self.start_assignment(watch_tab_switches=0)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"This assignment does not watch tab switches.",
			pastes.record_paste,
			project,
			EVEN_NUMBERS,
		)

	def test_deleting_the_assignment_deletes_its_pastes(self):
		assignment, project = self.start_assignment(watch_tab_switches=1)
		pastes.record_paste(project, EVEN_NUMBERS)

		frappe.set_user(self.faculty_user)
		api.delete_assignment(assignment)

		self.assertFalse(frappe.db.exists("CS17 Paste", {"assignment": assignment}))
