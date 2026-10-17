# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import base64
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.cs17_portal.doctype.cs17_project.cs17_project import get_permission_query_conditions
from cs17_portal.tests.test_submission_archive import make_zip

STUDENT1_USER = "cs17-project-student1@example.com"
STUDENT2_USER = "cs17-project-student2@example.com"
FACULTY_IN_USER = "cs17-project-faculty-in@example.com"
FACULTY_OUT_USER = "cs17-project-faculty-out@example.com"
SAMPLE_PROJECT = make_zip({"project.json": b"v1"})


def ensure_user(email: str, roles: tuple[str, ...] = ()) -> str:
	# User creation commits (welcome-email flow) and so escapes test rollback — create it idempotently.
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0}
		).insert(ignore_permissions=True)
	frappe.get_doc("User", email).add_roles(*roles)
	return email


def b64(payload: bytes) -> str:
	return base64.b64encode(payload).decode()


class TestCS17Project(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		for user in (STUDENT1_USER, STUDENT2_USER):
			ensure_user(user, roles=("CS17 Student",))
		for user in (FACULTY_IN_USER, FACULTY_OUT_USER):
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

		self.assignment = self.make_assignment(self.cohort_in)
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
			frappe.get_all("CS17 Project", filters={"profile": ["in", profiles]}, pluck="name")
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

	def make_assignment(
		self,
		cohort: str,
		submission_type: str = "Scratch",
		is_published: int = 1,
		assignment_type: str = "Graded",
	) -> str:
		# before_insert enforces Faculty membership of the acting user, so create it as a cohort faculty.
		frappe.set_user(FACULTY_IN_USER)
		assignment = frappe.get_doc(
			{
				"doctype": "CS17 Assignment",
				"title": "Scratch Test Assignment",
				"cohort": cohort,
				"submission_type": submission_type,
				"assignment_type": assignment_type,
				"remarks": "Marks",
				"max_marks": 100,
				"is_published": is_published,
				"due_date": frappe.utils.add_days(frappe.utils.now_datetime(), 7),
			}
		).insert(ignore_permissions=True)
		frappe.set_user("Administrator")
		return assignment.name

	def make_python_assignment(self, watch_tab_switches: int = 0) -> str:
		assignment = frappe.get_doc(
			"CS17 Assignment", self.make_assignment(self.cohort_in, submission_type="Python")
		)
		assignment.starter_code = "name = input()\n"
		assignment.watch_tab_switches = watch_tab_switches
		assignment.append("test_cases", {"input": "Asha\n", "expected_output": "Hello, Asha!\n"})
		assignment.append(
			"test_cases", {"input": "Ravi\n", "expected_output": "Hello, Ravi!\n", "is_hidden": 1}
		)
		assignment.save(ignore_permissions=True)
		return assignment.name

	def make_saved_project(self, content: bytes = SAMPLE_PROJECT) -> str:
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Student 1 Project")["name"]
		api.save_project(project, "project.sb3", b64(content))
		return project

	def make_submission(self, content: bytes = SAMPLE_PROJECT) -> str:
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
		original = make_zip({"project.json": b"original"})
		api.save_project(project, "project.sb3", b64(original))
		submission = api.submit_scratch_project(self.assignment, project)["name"]

		snapshot_url = frappe.db.get_value("CS17 Assignment Submission", submission, "submission_document")
		snapshot_before = frappe.get_doc(
			"File", {"file_url": snapshot_url, "attached_to_name": submission}
		).get_content()

		# Editing the live project after submission must not touch the snapshot bytes.
		api.save_project(project, "project.sb3", b64(make_zip({"project.json": b"edited-after-submit"})))
		snapshot_after = frappe.get_doc(
			"File", {"file_url": snapshot_url, "attached_to_name": submission}
		).get_content()

		self.assertEqual(snapshot_before, original)
		self.assertEqual(snapshot_before, snapshot_after)

	def test_get_submission_project_returns_sb3_bytes_to_faculty_in_cohort(self):
		project = make_zip({"project.json": b"real-project-bytes"})
		submission = self.make_submission(content=project)
		frappe.set_user(FACULTY_IN_USER)
		result = api.get_submission_project(submission)

		self.assertTrue(result["filename"].endswith(".sb3"))
		# The base64 content must decode back to the exact snapshot bytes so the read-only player
		# renders the student's real project (regression for the blank-player 403).
		self.assertEqual(base64.b64decode(result["content"]), project)

	def test_get_submission_project_reports_a_missing_project_file(self):
		submission = self.make_submission()
		frappe.db.delete("File", {"attached_to_name": submission})

		frappe.set_user(FACULTY_IN_USER)
		self.assertRaisesRegex(
			frappe.DoesNotExistError,
			"This submission's project file is missing.",
			api.get_submission_project,
			submission,
		)

	def test_get_submission_project_reports_a_project_file_gone_from_disk(self):
		submission = self.make_submission()
		frappe.db.set_value("File", {"attached_to_name": submission}, "file_url", "/private/files/gone.sb3")
		frappe.db.set_value(
			"CS17 Assignment Submission", submission, "submission_document", "/private/files/gone.sb3"
		)

		frappe.set_user(FACULTY_IN_USER)
		self.assertRaisesRegex(
			frappe.DoesNotExistError,
			"This submission's project file is missing.",
			api.get_submission_project,
			submission,
		)

	def test_get_submission_project_reports_a_missing_submission(self):
		frappe.set_user(FACULTY_IN_USER)
		self.assertRaises(frappe.DoesNotExistError, api.get_submission_project, "missing-submission")

	def test_get_submission_project_reports_a_submission_without_a_file(self):
		submission = frappe.get_doc(
			{"doctype": "CS17 Assignment Submission", "student": self.student1, "assignment": self.assignment}
		).insert(ignore_permissions=True)

		frappe.set_user(FACULTY_IN_USER)
		self.assertRaisesRegex(
			frappe.DoesNotExistError,
			"This submission has no project file.",
			api.get_submission_project,
			submission.name,
		)

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

	def test_save_grade_keeps_a_draft_grade_unpublished(self):
		submission = self.make_submission()
		frappe.set_user(FACULTY_IN_USER)
		grade = api.save_grade(submission, marks_obtained=60)
		frappe.db.set_value("CS17 Assignment Grade", grade["name"], "is_published", 0)

		self.assertEqual(api.save_grade(submission, marks_obtained=90)["is_published"], 0)

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

	def test_submit_to_non_scratch_assignment_rejected(self):
		pdf_assignment = self.make_assignment(self.cohort_in, submission_type="PDF")
		project = self.make_saved_project()
		self.assertRaises(frappe.ValidationError, api.submit_scratch_project, pdf_assignment, project)

	def test_submit_to_unpublished_assignment_rejected(self):
		unpublished = self.make_assignment(self.cohort_in, is_published=0)
		project = self.make_saved_project()
		self.assertRaises(frappe.ValidationError, api.submit_scratch_project, unpublished, project)

	def test_submit_to_assignment_past_its_publish_time_accepted(self):
		scheduled = self.make_assignment(self.cohort_in, is_published=0)
		frappe.db.set_value(
			"CS17 Assignment", scheduled, "publish_on", frappe.utils.add_days(frappe.utils.now_datetime(), -1)
		)
		project = self.make_saved_project()
		self.assertTrue(api.submit_scratch_project(scheduled, project)["name"])

	def test_grade_on_not_graded_assignment_rejected(self):
		not_graded = self.make_assignment(self.cohort_in, assignment_type="Not Graded")
		project = self.make_saved_project()
		submission = api.submit_scratch_project(not_graded, project)["name"]
		frappe.set_user(FACULTY_IN_USER)
		self.assertRaises(frappe.ValidationError, api.save_grade, submission, 50)

	def test_second_save_replaces_the_project_file(self):
		project = self.make_saved_project()
		api.save_project(project, "project.sb3", b64(make_zip({"project.json": b"v2"})))

		self.assertEqual(
			frappe.db.count(
				"File",
				{"attached_to_doctype": "CS17 Project", "attached_to_name": project},
			),
			1,
		)

	def test_project_file_that_is_not_a_zip_is_refused(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Student 1 Project")["name"]

		self.assertRaisesRegex(
			frappe.ValidationError,
			"This file is not a Scratch project.",
			api.save_project,
			project,
			"project.sb3",
			b64(b"PK\x03\x04v1"),
		)

	def test_zip_without_project_json_is_refused(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Student 1 Project")["name"]

		self.assertRaisesRegex(
			frappe.ValidationError,
			"This file is not a Scratch project.",
			api.save_project,
			project,
			"project.sb3",
			b64(make_zip({"notes.txt": b"ls -la\n"})),
		)

	def test_python_project_keeps_its_saved_code(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Number Guesser", project_type="Python")["name"]
		api.save_python_project(project, 'print("hello")\n')

		self.assertEqual(api.get_project(project)["code"], 'print("hello")\n')

	def test_python_code_is_not_saved_to_a_scratch_project(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Student 1 Project")["name"]

		self.assertRaisesRegex(
			frappe.ValidationError,
			"This is not a Python project.",
			api.save_python_project,
			project,
			'print("hello")\n',
		)

	def test_student_sees_sample_tests_but_not_hidden_ones(self):
		assignment = self.make_python_assignment()

		frappe.set_user(STUDENT1_USER)
		details = api.get_student_assignment(assignment)

		self.assertEqual(details.sample_tests, [{"input": "Asha\n", "expected_output": "Hello, Asha!\n"}])
		self.assertEqual(details.hidden_test_count, 1)

	def test_python_assignment_starts_from_the_starter_code(self):
		assignment = self.make_python_assignment()

		frappe.set_user(STUDENT1_USER)
		project = api.start_python_assignment(assignment)["name"]

		self.assertEqual(api.get_project(project)["code"], "name = input()\n")

	def test_python_assignment_reopens_the_same_project(self):
		assignment = self.make_python_assignment()

		frappe.set_user(STUDENT1_USER)
		project = api.start_python_assignment(assignment)["name"]

		self.assertEqual(api.start_python_assignment(assignment)["name"], project)

	def test_two_first_starts_at_the_same_moment_make_one_project(self):
		assignment = self.make_python_assignment()
		get_value = frappe.db.get_value

		def without_projects(doctype, *args, **kwargs):
			return None if doctype == "CS17 Project" else get_value(doctype, *args, **kwargs)

		frappe.set_user(STUDENT1_USER)
		with patch.object(frappe.db, "get_value", side_effect=without_projects):
			api.start_python_assignment(assignment)
			api.start_python_assignment(assignment)

		self.assertEqual(frappe.db.count("CS17 Project", {"assignment": assignment}), 1)

	def test_python_assignment_made_again_after_a_delete_starts_a_new_project(self):
		assignment = self.make_python_assignment()
		frappe.set_user(STUDENT1_USER)
		api.start_python_assignment(assignment)
		frappe.set_user(FACULTY_IN_USER)
		api.delete_assignment(assignment)
		assignment = self.make_python_assignment()
		frappe.set_user(STUDENT1_USER)

		project = api.start_python_assignment(assignment)["name"]

		self.assertEqual(api.get_project(project)["assignment"], assignment)

	def test_python_submission_keeps_a_copy_of_the_code(self):
		assignment = self.make_python_assignment()
		frappe.set_user(STUDENT1_USER)
		project = api.start_python_assignment(assignment)["name"]
		api.save_python_project(project, 'print(f"Hello, {input()}!")\n')
		submission = api.submit_python_project(assignment, project)["name"]

		frappe.set_user(FACULTY_IN_USER)
		self.assertEqual(api.get_submission_code(submission), 'print(f"Hello, {input()}!")\n')

	def test_scratch_assignment_refuses_a_python_project(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Student 1 Program", project_type="Python")["name"]
		api.save_python_project(project, 'print("hello")\n')

		self.assertRaisesRegex(
			frappe.ValidationError,
			"This assignment does not accept Python projects.",
			api.submit_python_project,
			self.assignment,
			project,
		)

	def test_test_cases_are_dropped_when_the_assignment_is_not_python(self):
		assignment = frappe.get_doc("CS17 Assignment", self.make_python_assignment())
		assignment.submission_type = "PDF"
		assignment.save(ignore_permissions=True)

		self.assertEqual(assignment.test_cases, [])

	def test_faculty_sees_a_tab_leave_and_its_return(self):
		assignment = self.make_python_assignment(watch_tab_switches=1)
		frappe.set_user(STUDENT1_USER)
		project = api.start_python_assignment(assignment)["name"]
		api.record_tab_leave(project)
		api.record_tab_return(project)
		api.save_python_project(project, 'print(f"Hello, {input()}!")\n')
		submission = api.submit_python_project(assignment, project)["name"]

		frappe.set_user(FACULTY_IN_USER)
		leaves = api.get_tab_leaves(submission)

		self.assertEqual(len(leaves), 1)
		self.assertTrue(leaves[0]["left_at"] and leaves[0]["returned_at"])

	def test_tab_leave_is_refused_when_the_assignment_does_not_watch(self):
		assignment = self.make_python_assignment()
		frappe.set_user(STUDENT1_USER)
		project = api.start_python_assignment(assignment)["name"]

		self.assertRaisesRegex(
			frappe.ValidationError,
			"This assignment does not watch tab switches.",
			api.record_tab_leave,
			project,
		)

	def test_first_submit_saves_the_submission_once(self):
		project = self.make_saved_project()
		submission = frappe.get_doc(
			"CS17 Assignment Submission", api.submit_scratch_project(self.assignment, project)["name"]
		)

		self.assertEqual(submission.project, project)
		self.assertTrue(submission.submitted_at)
		self.assertEqual(
			frappe.db.count(
				"File",
				{
					"attached_to_doctype": "CS17 Assignment Submission",
					"attached_to_name": submission.name,
					"file_url": submission.submission_document,
				},
			),
			1,
		)
		self.assertEqual(submission.modified, submission.creation)
		self.assertEqual(
			frappe.db.count(
				"Version", {"ref_doctype": "CS17 Assignment Submission", "docname": submission.name}
			),
			0,
		)

	def test_resubmit_revises_the_same_submission(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Revise Project")["name"]
		api.save_project(project, "project.sb3", b64(SAMPLE_PROJECT))
		first = api.submit_scratch_project(self.assignment, project)["name"]
		api.save_project(project, "project.sb3", b64(make_zip({"project.json": b"v2"})))
		second = api.submit_scratch_project(self.assignment, project)["name"]

		self.assertEqual(first, second)
		self.assertEqual(
			frappe.db.count(
				"CS17 Assignment Submission",
				{"assignment": self.assignment, "student": self.student1},
			),
			1,
		)

	def test_resubmit_replaces_the_snapshot_file(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Revise Project")["name"]
		api.save_project(project, "project.sb3", b64(SAMPLE_PROJECT))
		api.submit_scratch_project(self.assignment, project)
		api.save_project(project, "project.sb3", b64(make_zip({"project.json": b"v2"})))
		submission = api.submit_scratch_project(self.assignment, project)["name"]

		self.assertEqual(
			frappe.db.count(
				"File",
				{"attached_to_doctype": "CS17 Assignment Submission", "attached_to_name": submission},
			),
			1,
		)

	def test_cannot_resubmit_after_grade_published(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Graded Project")["name"]
		api.save_project(project, "project.sb3", b64(SAMPLE_PROJECT))
		submission = api.submit_scratch_project(self.assignment, project)["name"]

		frappe.set_user(FACULTY_IN_USER)
		api.save_grade(submission, marks_obtained=80)

		frappe.set_user(STUDENT1_USER)
		api.save_project(project, "project.sb3", b64(make_zip({"project.json": b"v2"})))
		self.assertRaises(frappe.ValidationError, api.submit_scratch_project, self.assignment, project)

	def test_scratch_assignment_reopens_the_same_project(self):
		frappe.set_user(STUDENT1_USER)
		project = api.create_project("Scratch Test Assignment", self.assignment)["name"]

		self.assertEqual(api.create_project("Scratch Test Assignment", self.assignment)["name"], project)

	def test_two_first_opens_of_a_scratch_assignment_at_the_same_moment_make_one_project(self):
		get_value = frappe.db.get_value

		def without_projects(doctype, *args, **kwargs):
			return None if doctype == "CS17 Project" else get_value(doctype, *args, **kwargs)

		frappe.set_user(STUDENT1_USER)
		with patch.object(frappe.db, "get_value", side_effect=without_projects):
			api.create_project("Scratch Test Assignment", self.assignment)
			api.create_project("Scratch Test Assignment", self.assignment)

		self.assertEqual(frappe.db.count("CS17 Project", {"assignment": self.assignment}), 1)

	def test_project_cannot_start_from_an_unpublished_assignment(self):
		unpublished = self.make_assignment(self.cohort_in, is_published=0)
		frappe.set_user(STUDENT1_USER)

		self.assertRaisesRegex(
			frappe.ValidationError,
			"This assignment is not open for submission.",
			api.create_project,
			"Scratch Test Assignment",
			unpublished,
		)
