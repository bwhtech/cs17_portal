# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import base64

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api, gallery
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user
from cs17_portal.tests.test_submission_archive import make_zip

MAZE_GAME = make_zip({"project.json": b'{"targets": []}'})
PAGE_WITH_SCRIPT = b"<script>alert(document.cookie)</script>"


class TestGallery(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C1170TEST")
		cls.faculty_user = make_user("faculty1170@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Meera Iyer")
		cls.student_user = make_user("student1170@cs17test.com")
		make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.classmate_user = make_user("student1171@cs17test.com")
		cls.classmate = make_profile("Student", cls.cohort, cls.classmate_user, "Diya Patel")

		other_cohort = make_cohort("C1171TEST")
		cls.other_faculty_user = make_user("faculty1171@cs17test.com")
		make_profile("Faculty", other_cohort, cls.other_faculty_user, "Rohan Mehta")
		cls.other_student_user = make_user("student1172@cs17test.com")
		make_profile("Student", other_cohort, cls.other_student_user, "Kabir Singh")
		for user in (cls.student_user, cls.classmate_user, cls.other_student_user):
			frappe.get_doc("User", user).add_roles("CS17 Student")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")

	def share_maze_game(self) -> str:
		frappe.set_user(self.student_user)
		project = api.create_project("Maze game")["name"]
		api.save_project(project, "project.sb3", base64.b64encode(MAZE_GAME).decode())
		gallery.share_project(project)
		return project

	def test_classmate_sees_the_shared_project(self):
		project = self.share_maze_game()

		frappe.set_user(self.classmate_user)
		shared = {row.name: row.student_name for row in gallery.get_shared_projects()}

		self.assertEqual(shared.get(project), "Aarav Sharma")

	def test_student_of_another_cohort_cannot_open_a_shared_project(self):
		project = self.share_maze_game()

		frappe.set_user(self.other_student_user)

		self.assertRaises(frappe.PermissionError, gallery.get_shared_project, project)

	def test_assignment_work_cannot_be_shared(self):
		frappe.set_user(self.faculty_user)
		assignment = api.create_assignment(
			"Loops practice", self.cohort, "2030-01-01 00:00:00", submission_type="Python", publish="now"
		)
		frappe.set_user(self.student_user)
		project = api.start_python_assignment(assignment)["name"]

		self.assertRaisesRegex(
			frappe.ValidationError, "Work for an assignment cannot be shared.", gallery.share_project, project
		)

	def test_copy_is_the_students_own_unshared_project(self):
		project = self.share_maze_game()

		frappe.set_user(self.classmate_user)
		copy = gallery.copy_shared_project(project)["name"]

		self.assertEqual(
			frappe.db.get_value("CS17 Project", copy, ["profile", "project_title", "is_shared"]),
			(self.classmate, "Maze game (copy)", 0),
		)

	def test_copy_keeps_its_file_when_the_original_is_deleted(self):
		project = self.share_maze_game()
		frappe.set_user(self.classmate_user)
		copy = gallery.copy_shared_project(project)["name"]

		frappe.set_user(self.student_user)
		api.delete_project(project)

		sb3_file = frappe.get_doc("File", {"attached_to_name": copy, "attached_to_field": "sb3_file"})
		self.assertEqual(sb3_file.get_content(encodings=()), MAZE_GAME)

	def test_cohort_faculty_stops_sharing(self):
		project = self.share_maze_game()

		frappe.set_user(self.faculty_user)
		gallery.unshare_project(project)

		self.assertEqual(frappe.db.get_value("CS17 Project", project, "is_shared"), 0)

	def test_faculty_of_another_cohort_cannot_stop_sharing(self):
		project = self.share_maze_game()

		frappe.set_user(self.other_faculty_user)

		self.assertRaises(frappe.PermissionError, gallery.unshare_project, project)

	def test_html_thumbnail_is_refused_on_save(self):
		frappe.set_user(self.student_user)
		project = api.create_project("Maze game")["name"]

		self.assertRaisesRegex(
			frappe.ValidationError,
			"The thumbnail must be a PNG image.",
			api.save_project,
			project,
			"project.sb3",
			base64.b64encode(MAZE_GAME).decode(),
			"thumbnail.html",
			base64.b64encode(PAGE_WITH_SCRIPT).decode(),
		)

	def test_stored_html_thumbnail_is_not_served(self):
		project = self.share_maze_game()
		thumbnail = api.attach_private_file(
			"CS17 Project", project, "thumbnail", "thumbnail.html", PAGE_WITH_SCRIPT
		)
		frappe.db.set_value("CS17 Project", project, "thumbnail", thumbnail.file_url)

		frappe.set_user(self.classmate_user)

		self.assertRaises(frappe.DoesNotExistError, gallery.get_shared_thumbnail, project)
