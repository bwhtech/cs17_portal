# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import base64

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.cs17_portal.doctype.cs17_project.cs17_project import get_permission_query_conditions

STUDENT1_USER = "cs17-project-student1@example.com"
STUDENT2_USER = "cs17-project-student2@example.com"
FACULTY_IN_USER = "cs17-project-faculty-in@example.com"
FACULTY_OUT_USER = "cs17-project-faculty-out@example.com"


def ensure_user(email: str) -> str:
	# User creation commits (welcome-email flow) and so escapes test rollback — create it idempotently.
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0}
		).insert(ignore_permissions=True)
	frappe.get_doc("User", email).add_roles("CS17 Student")
	return email


def b64(payload: bytes) -> str:
	return base64.b64encode(payload).decode()


class TestCS17Project(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		for user in (STUDENT1_USER, STUDENT2_USER, FACULTY_IN_USER, FACULTY_OUT_USER):
			ensure_user(user)

		# Users, and anything created before a User insert's commit, escape test rollback — so clean up
		# any fixtures left by a prior run before recreating them, in link-safe order.
		self.cleanup_fixtures()

		self.cohort_in = self.make_cohort("CS17-PROJ-IN")
		self.cohort_out = self.make_cohort("CS17-PROJ-OUT")

		self.student1 = self.make_profile("Student", STUDENT1_USER, self.cohort_in)
		self.student2 = self.make_profile("Student", STUDENT2_USER, self.cohort_in)
		self.make_profile("Faculty", FACULTY_IN_USER, self.cohort_in)
		self.make_profile("Faculty", FACULTY_OUT_USER, self.cohort_out)

		self.assignment = self.make_scratch_assignment(self.cohort_in)
		self.addCleanup(lambda: frappe.set_user("Administrator"))

	def cleanup_fixtures(self):
		users = [STUDENT1_USER, STUDENT2_USER, FACULTY_IN_USER, FACULTY_OUT_USER]
		cohorts = ["CS17-PROJ-IN", "CS17-PROJ-OUT"]
		profiles = frappe.get_all("CS17 Profile", filters={"user": ["in", users]}, pluck="name")
		submissions = (
			frappe.get_all("CS17 Assignment Submission", filters={"student": ["in", profiles]}, pluck="name")
			if profiles
			else []
		)
		projects = (
			frappe.get_all("CS17 Project", filters={"student": ["in", profiles]}, pluck="name")
			if profiles
			else []
		)
		assignments = frappe.get_all("CS17 Assignment", filters={"cohort": ["in", cohorts]}, pluck="name")
		grades = (
			frappe.get_all("CS17 Assignment Grade", filters={"submission": ["in", submissions]}, pluck="name")
			if submissions
			else []
		)

		def drop(doctype, names):
			for name in names:
				frappe.delete_doc(doctype, name, force=True, ignore_permissions=True, delete_permanently=True)

		drop("CS17 Assignment Grade", grades)
		for name in submissions:
			# Submitted docs can't be force-deleted; cancel first.
			submission = frappe.get_doc("CS17 Assignment Submission", name)
			if submission.docstatus == 1:
				submission.flags.ignore_permissions = True
				submission.cancel()
		drop("CS17 Assignment Submission", submissions)
		drop("CS17 Project", projects)
		drop("CS17 Assignment", assignments)
		drop("CS17 Profile", profiles)
		drop("CS17 Cohort", [c for c in cohorts if frappe.db.exists("CS17 Cohort", c)])

	def make_cohort(self, code: str) -> str:
		return (
			frappe.get_doc(
				{"doctype": "CS17 Cohort", "cohort_code": code, "start_date": frappe.utils.nowdate()}
			)
			.insert(ignore_permissions=True)
			.name
		)

	def make_profile(self, profile_type: str, user: str, cohort: str) -> str:
		return (
			frappe.get_doc(
				{
					"doctype": "CS17 Profile",
					"profile_type": profile_type,
					"first_name": user.split("@")[0],
					"last_name": "Test",
					"user": user,
					"cohort": cohort,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	def make_scratch_assignment(self, cohort: str) -> str:
		# before_insert enforces Faculty membership of the acting user, so create it as a cohort faculty.
		frappe.set_user(FACULTY_IN_USER)
		assignment = frappe.get_doc(
			{
				"doctype": "CS17 Assignment",
				"title": "Scratch Test Assignment",
				"cohort": cohort,
				"submission_type": "Scratch",
				"assignment_type": "Graded",
				"remarks": "Marks",
				"max_marks": 100,
				"is_published": 1,
				"due_date": frappe.utils.add_days(frappe.utils.now_datetime(), 7),
			}
		).insert(ignore_permissions=True)
		frappe.set_user("Administrator")
		return assignment.name

	def make_saved_project(self, content: bytes = b"PK\x03\x04v1") -> str:
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Student 1 Project")["name"]
		api.save_project(project, "project.sb3", b64(content))
		return project

	def make_submission(self, content: bytes = b"PK\x03\x04v1") -> str:
		project = self.make_saved_project(content)
		return api.submit_scratch_project(self.assignment, project)["name"]

	def test_query_conditions_scope_list_to_owner(self):
		project = self.make_saved_project()

		frappe.set_user(STUDENT1_USER)
		own = frappe.get_list("CS17 Project", filters={"name": project}, pluck="name")
		self.assertEqual(own, [project])

		frappe.set_user(STUDENT2_USER)
		leaked = frappe.get_list("CS17 Project", filters={"name": project}, pluck="name")
		self.assertEqual(leaked, [])

		condition = get_permission_query_conditions(STUDENT2_USER)
		self.assertIn(self.student2, condition)
		self.assertNotIn(self.student1, condition)

	def test_student_cannot_save_others_project(self):
		project = self.make_saved_project()
		frappe.set_user(STUDENT2_USER)
		self.assertRaises(
			frappe.PermissionError, api.save_project, project, "hack.sb3", b64(b"PK\x03\x04evil")
		)

	def test_student_cannot_submit_others_project(self):
		project = self.make_saved_project()
		frappe.set_user(STUDENT2_USER)
		self.assertRaises(frappe.PermissionError, api.submit_scratch_project, self.assignment, project)

	def test_submitted_snapshot_is_immutable(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Immutable Project")["name"]
		api.save_project(project, "project.sb3", b64(b"PK\x03\x04original"))
		submission = api.submit_scratch_project(self.assignment, project)["name"]

		snapshot_url = frappe.db.get_value("CS17 Assignment Submission", submission, "submission_document")
		snapshot_before = frappe.get_doc(
			"File", {"file_url": snapshot_url, "attached_to_name": submission}
		).get_content()

		# Editing the live project after submission must not touch the snapshot bytes.
		api.save_project(project, "project.sb3", b64(b"PK\x03\x04edited-after-submit"))
		snapshot_after = frappe.get_doc(
			"File", {"file_url": snapshot_url, "attached_to_name": submission}
		).get_content()

		self.assertEqual(snapshot_before, b"PK\x03\x04original")
		self.assertEqual(snapshot_before, snapshot_after)

	def test_get_submission_project_returns_sb3_bytes_to_faculty_in_cohort(self):
		submission = self.make_submission(content=b"PK\x03\x04real-project-bytes")
		frappe.set_user(FACULTY_IN_USER)
		result = api.get_submission_project(submission)

		self.assertTrue(result["filename"].endswith(".sb3"))
		# The base64 content must decode back to the exact snapshot bytes so the read-only player
		# renders the student's real project (regression for the blank-player 403).
		self.assertEqual(base64.b64decode(result["content"]), b"PK\x03\x04real-project-bytes")

	def test_get_submission_project_blocks_faculty_out_of_cohort(self):
		submission = self.make_submission()
		frappe.set_user(FACULTY_OUT_USER)
		self.assertRaises(frappe.PermissionError, api.get_submission_project, submission)

	def test_get_submission_project_blocks_other_student(self):
		submission = self.make_submission()
		frappe.set_user(STUDENT2_USER)
		self.assertRaises(frappe.PermissionError, api.get_submission_project, submission)

	def test_other_student_cannot_read_submission_or_its_file(self):
		# Regression for the IDOR: the CS17 Student role has a blanket read on CS17 Assignment Submission,
		# and private-file downloads defer to the attached doc's read perm — without the has_permission hook
		# any student could pull another student's private .sb3 snapshot via a guessable submission name.
		submission = self.make_submission()
		snapshot_url = frappe.db.get_value("CS17 Assignment Submission", submission, "submission_document")
		file_name = frappe.db.get_value(
			"File", {"file_url": snapshot_url, "attached_to_name": submission}, "name"
		)

		frappe.set_user(STUDENT2_USER)
		self.assertFalse(frappe.has_permission("CS17 Assignment Submission", "read", doc=submission))
		self.assertFalse(frappe.has_permission("File", "read", doc=file_name))

		# The owner is still allowed to read their own submission and snapshot.
		frappe.set_user(STUDENT1_USER)
		self.assertTrue(frappe.has_permission("CS17 Assignment Submission", "read", doc=submission))
		self.assertTrue(frappe.has_permission("File", "read", doc=file_name))

	def test_faculty_in_cohort_can_save_grade(self):
		submission = self.make_submission()
		frappe.set_user(FACULTY_IN_USER)
		grade = api.save_grade(submission, marks_obtained=80, remarks="Great work")

		self.assertEqual(grade["marks_obtained"], 80)
		self.assertEqual(grade["graded_by"], FACULTY_IN_USER)
		self.assertEqual(grade["is_published"], 1)
		self.assertEqual(
			frappe.db.get_value("CS17 Assignment Grade", {"submission": submission}, "graded_by"),
			FACULTY_IN_USER,
		)

	def test_faculty_out_of_cohort_cannot_save_grade(self):
		submission = self.make_submission()
		frappe.set_user(FACULTY_OUT_USER)
		self.assertRaises(frappe.PermissionError, api.save_grade, submission, 50)

	def test_student_cannot_save_grade(self):
		submission = self.make_submission()
		frappe.set_user(STUDENT2_USER)
		self.assertRaises(frappe.PermissionError, api.save_grade, submission, 50)

	def test_marks_over_max_rejected(self):
		submission = self.make_submission()
		frappe.set_user(FACULTY_IN_USER)
		# max_marks on the fixture assignment is 100.
		self.assertRaises(frappe.ValidationError, api.save_grade, submission, 150)

	def test_regrade_updates_same_row(self):
		submission = self.make_submission()
		frappe.set_user(FACULTY_IN_USER)
		first = api.save_grade(submission, marks_obtained=60)
		second = api.save_grade(submission, marks_obtained=90, remarks="Revised")

		self.assertEqual(first["name"], second["name"])
		self.assertEqual(second["marks_obtained"], 90)
		self.assertEqual(frappe.db.count("CS17 Assignment Grade", filters={"submission": submission}), 1)
