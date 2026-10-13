# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import answer_sheet
from cs17_portal.api import get_student_assignments
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_user

ROWS = [
	["#", "Task", "Expected answer", "Scored", "Student 31", "Student 32"],
	["1", "Create gallery folder", "gallery/ at the assignment root", "Yes", "OK", "Named gallary"],
	["2", "Print README.txt", "cat README.txt", "No", "Seen in history", "Seen in history"],
	["", "Score (out of 20)", "Scored rows only", "", "20", "19"],
]


class TestAnswerSheet(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.cohort = make_cohort("C31TEST")
		cls.faculty_user = make_user("faculty31@cs17test.com")
		cls.student_user = make_user("student31@cs17test.com")
		cls.faculty_without_cohort_user = make_user("faculty33@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Faculty 31")
		make_profile("Faculty", None, cls.faculty_without_cohort_user, "Faculty 33")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Student 31")
		make_profile("Student", cls.cohort, make_user("student32@cs17test.com"), "Student 32")
		frappe.set_user(cls.faculty_user)
		cls.assignment = make_assignment(cls.cohort, "Terminal Task 31", "ZIP", 20)
		frappe.set_user("Administrator")

	def setUp(self):
		sheet = answer_sheet.parse_answer_sheet(ROWS, self.cohort)
		frappe.db.set_value("CS17 Assignment", self.assignment, "answer_sheet", frappe.as_json(sheet))
		frappe.db.set_value("CS17 Assignment", self.assignment, "show_answers", 0)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_parse_marks_scored_answers_and_matches_the_student(self):
		first, second = answer_sheet.parse_answer_sheet(ROWS, self.cohort)["students"]

		self.assertEqual(first["student"], self.student)
		self.assertEqual([result["status"] for result in first["results"]], ["Correct", ""])
		self.assertEqual(second["results"][0]["status"], "Incorrect")
		self.assertEqual(first["summary"], [{"label": "Score (out of 20)", "value": "20"}])

	def test_cell_starting_with_half_is_marked_half(self):
		header, task, *_rest = ROWS
		rows = [header, [*task[:5], "Half: named gallary"]]

		result = answer_sheet.parse_answer_sheet(rows, self.cohort)["students"][1]["results"][0]

		self.assertEqual(result, {"remark": "named gallary", "status": "Half"})

	def test_task_heading_with_a_zero_width_space_is_accepted(self):
		header, task, *_rest = ROWS
		rows = [[header[0], "Task\u200b", *header[2:]], task]

		sheet = answer_sheet.parse_answer_sheet(rows, self.cohort)

		self.assertEqual(sheet["tasks"][0]["task"], "Create gallery folder")

	def test_heading_with_stray_spaces_matches_the_student(self):
		matched = answer_sheet.match_students([" Student  31 "], self.cohort)

		self.assertEqual(matched, {" Student  31 ": self.student})

	def test_two_headings_for_one_student_match_no_one(self):
		matched = answer_sheet.match_students(["Student 31", "student  31"], self.cohort)

		self.assertEqual(matched, {"Student 31": None, "student  31": None})

	def test_heading_repeated_in_two_columns_matches_no_one(self):
		header, *body = ROWS
		rows = [[*header[:5], "Student 31"], *body]

		students = answer_sheet.parse_answer_sheet(rows, self.cohort)["students"]

		self.assertEqual([row["student"] for row in students], [None, None])

	def test_upload_and_replace_leave_no_file_behind(self):
		frappe.set_user(self.faculty_user)

		for rows in (ROWS, ROWS[:3]):
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": "answers-31.csv",
					"is_private": 1,
					"content": "\n".join(",".join(row) for row in rows),
				}
			).save(ignore_permissions=True)
			answer_sheet.upload_answer_sheet(self.assignment, file.file_url)

		self.assertFalse(
			frappe.db.exists("File", {"owner": self.faculty_user, "attached_to_name": ("is", "not set")})
		)

	def test_student_gets_no_answers_until_they_are_shown(self):
		frappe.set_user(self.student_user)

		self.assertIsNone(answer_sheet.get_my_answers(self.assignment))

	def test_student_gets_only_their_own_answers(self):
		frappe.set_user(self.faculty_user)
		answer_sheet.show_answers(self.assignment, True)
		frappe.set_user(self.student_user)

		answers = answer_sheet.get_my_answers(self.assignment)["answers"]

		self.assertEqual([answer["remark"] for answer in answers], ["OK", "Seen in history"])

	def test_sheet_without_student_columns_shows_every_student_the_expected_answers(self):
		sheet = answer_sheet.parse_answer_sheet([row[:4] for row in ROWS[:3]], self.cohort)
		frappe.db.set_value("CS17 Assignment", self.assignment, "answer_sheet", frappe.as_json(sheet))
		frappe.set_user(self.faculty_user)
		answer_sheet.show_answers(self.assignment, True)
		frappe.set_user(self.student_user)

		answers = answer_sheet.get_my_answers(self.assignment)["answers"]

		self.assertEqual(answers[0]["expected"], "gallery/ at the assignment root")
		self.assertEqual(answers[0]["status"], "")

	def test_faculty_marks_a_student_the_sheet_has_no_column_for(self):
		sheet = answer_sheet.parse_answer_sheet([row[:4] for row in ROWS[:3]], self.cohort)
		frappe.db.set_value("CS17 Assignment", self.assignment, "answer_sheet", frappe.as_json(sheet))
		frappe.set_user(self.faculty_user)

		answer_sheet.set_answer_status(self.assignment, "Student 31", 0, "Correct", student=self.student)

		answers = answer_sheet.get_answers_for(self.assignment, self.student)
		self.assertIsNone(answers)
		answer_sheet.show_answers(self.assignment, True)
		self.assertEqual(
			answer_sheet.get_answers_for(self.assignment, self.student)["answers"][0]["status"], "Correct"
		)

	def test_student_reads_the_note_a_faculty_wrote_on_an_answer(self):
		frappe.set_user(self.faculty_user)
		answer_sheet.show_answers(self.assignment, True)

		answer_sheet.set_answer_remark(self.assignment, "Student 31", 0, "Named gallary", self.student)

		frappe.set_user(self.student_user)
		answers = answer_sheet.get_my_answers(self.assignment)["answers"]
		self.assertEqual(answers[0]["remark"], "Named gallary")

	def test_assignment_list_says_which_assignments_have_answers(self):
		frappe.set_user(self.faculty_user)
		answer_sheet.show_answers(self.assignment, True)
		frappe.set_user(self.student_user)

		assignments = get_student_assignments()["assignments"]

		self.assertEqual([row.has_answers for row in assignments], [True])

	def test_faculty_marks_one_answer_half(self):
		frappe.set_user(self.faculty_user)

		answer_sheet.set_answer_status(self.assignment, "Student 32", 0, "Half")

		sheet = answer_sheet.get_answer_sheet(self.assignment)["sheet"]
		self.assertEqual(sheet["students"][1]["results"][0]["status"], "Half")

	def test_marking_an_answer_locks_the_sheet_it_reads(self):
		frappe.set_user(self.faculty_user)

		with patch.object(frappe.db, "get_value", wraps=frappe.db.get_value) as get_value:
			answer_sheet.set_answer_status(self.assignment, "Student 32", 0, "Half")
			answer_sheet.set_answer_remark(self.assignment, "Student 32", 0, "Named gallary")

		locked = [call.args[:2] for call in get_value.call_args_list if call.kwargs.get("for_update")]
		self.assertEqual(locked, [("CS17 Assignment", self.assignment)] * 2)

	def test_marking_an_answer_is_refused_once_the_sheet_is_removed(self):
		frappe.set_user(self.faculty_user)
		answer_sheet.remove_answer_sheet(self.assignment)

		self.assertRaises(
			frappe.DoesNotExistError,
			answer_sheet.set_answer_status,
			self.assignment,
			"Student 32",
			0,
			"Half",
		)

	def test_note_on_a_task_the_sheet_does_not_have_is_refused(self):
		frappe.set_user(self.faculty_user)

		self.assertRaises(
			frappe.DoesNotExistError,
			answer_sheet.set_answer_remark,
			self.assignment,
			"Student 32",
			2,
			"Named gallary",
		)

	def test_reading_the_sheet_reports_a_missing_assignment(self):
		frappe.set_user(self.faculty_without_cohort_user)

		self.assertRaises(frappe.DoesNotExistError, answer_sheet.get_answer_sheet, "missing-assignment")

	def test_showing_answers_reports_a_missing_assignment(self):
		frappe.set_user(self.faculty_without_cohort_user)

		self.assertRaises(frappe.DoesNotExistError, answer_sheet.show_answers, "missing-assignment", True)

	def test_removing_the_sheet_reports_a_missing_assignment(self):
		frappe.set_user(self.faculty_without_cohort_user)

		self.assertRaises(frappe.DoesNotExistError, answer_sheet.remove_answer_sheet, "missing-assignment")
