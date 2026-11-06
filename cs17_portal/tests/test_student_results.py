# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import api
from cs17_portal.tests.test_api import make_cohort, make_profile, make_user
from cs17_portal.tests.test_faculty_results import make_result


class TestStudentResults(FrappeTestCase):
	def test_result_card_shows_grades_without_marks(self):
		cohort = make_cohort("C413TEST")
		user = make_user("student413@cs17test.com")
		frappe.get_doc("User", user).add_roles("CS17 Student")
		student = make_profile("Student", cohort, user, "Student 413")
		subject = (
			frappe.get_doc(
				{"doctype": "CS17 Subject", "subject_code": "MATHS413", "subject_name": "Maths 413"}
			)
			.insert(ignore_permissions=True)
			.name
		)
		scale = (
			frappe.get_doc(
				{
					"doctype": "CS17 Grading Scale",
					"scale_name": "Scale 413",
					"bands": [{"grade": "A", "min_percent": 0, "max_percent": 100}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		result = make_result(cohort, student, subject, scale)
		frappe.db.set_value("CS17 Result", result, "is_published", 1)
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(user)

		card = api.get_student_result(result)

		self.assertNotIn("percentage", card)
		self.assertEqual(list(card["scores"][0]), ["subject", "subject_name", "grade", "is_pass", "remarks"])
