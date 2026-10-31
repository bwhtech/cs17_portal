# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user
from cs17_portal.voice_remarks import get_voice_remark

VOICE_REMARK = "data:audio/webm;codecs=opus;base64,R0tFQkE="


class TestVoiceRemarks(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C537TEST")
		cls.faculty_user = make_user("faculty537@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Kavita Rao")
		cls.student_user = make_user("student537@cs17test.com")
		cls.other_student_user = make_user("student538@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		make_profile("Student", cls.cohort, cls.other_student_user, "Diya Menon")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		assignment = make_assignment(self.cohort, "Loops practice", "PDF", 0)
		frappe.db.set_value("CS17 Assignment", assignment, {"assignment_type": "Not Graded", "remarks": ""})
		self.submission = make_submission(assignment, self.student, "Aarav Sharma", "Loops practice")

	def test_a_voice_remark_is_stored_as_a_private_file_on_the_grade(self):
		grade = api.save_grade(self.submission, remarks="Good use of loops.", voice_remark=VOICE_REMARK)

		file = frappe.get_doc("File", {"file_url": grade["voice_remark"]})
		self.assertEqual(
			(file.is_private, file.attached_to_doctype, file.attached_to_name, file.attached_to_field),
			(1, "CS17 Assignment Grade", grade["name"], "voice_remark"),
		)

	def test_a_voice_remark_counts_as_remarks_on_not_graded_work(self):
		grade = api.save_grade(self.submission, voice_remark=VOICE_REMARK)

		self.assertTrue(frappe.db.exists("CS17 Assignment Grade", grade["name"]))

	def test_a_new_voice_remark_deletes_the_old_one(self):
		api.save_grade(self.submission, voice_remark=VOICE_REMARK)
		grade = api.save_grade(self.submission, voice_remark="data:audio/webm;base64,U2Vjb25k")

		voice_remarks = frappe.get_all(
			"File",
			filters={"attached_to_name": grade["name"], "attached_to_field": "voice_remark"},
			pluck="file_url",
		)
		self.assertEqual(voice_remarks, [grade["voice_remark"]])

	def test_an_empty_voice_remark_removes_it(self):
		api.save_grade(self.submission, remarks="Good use of loops.", voice_remark=VOICE_REMARK)
		grade = api.save_grade(self.submission, remarks="Good use of loops.", voice_remark="")

		self.assertIsNone(grade["voice_remark"])
		self.assertFalse(frappe.db.exists("File", {"attached_to_name": grade["name"]}))

	def test_leaving_out_the_voice_remark_keeps_it(self):
		saved = api.save_grade(self.submission, voice_remark=VOICE_REMARK)["voice_remark"]
		grade = api.save_grade(self.submission, remarks="Check the 0 case.")

		self.assertEqual(grade["voice_remark"], saved)

	def test_only_the_student_who_owns_the_submission_can_fetch_the_voice_remark(self):
		api.save_grade(self.submission, voice_remark=VOICE_REMARK)

		frappe.set_user(self.student_user)
		self.assertEqual(get_voice_remark(self.submission), "data:audio/webm;base64,R0tFQkE=")
		frappe.set_user(self.other_student_user)
		self.assertRaises(frappe.DoesNotExistError, get_voice_remark, self.submission)

	def test_a_student_cannot_fetch_the_voice_remark_before_the_grade_is_published(self):
		grade = api.save_grade(self.submission, voice_remark=VOICE_REMARK)
		frappe.db.set_value("CS17 Assignment Grade", grade["name"], "is_published", 0)

		frappe.set_user(self.student_user)
		self.assertRaises(frappe.DoesNotExistError, get_voice_remark, self.submission)
