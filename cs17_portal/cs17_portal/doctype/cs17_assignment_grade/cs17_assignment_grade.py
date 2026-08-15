# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class CS17AssignmentGrade(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assignment: DF.Link
		assignment_title: DF.Data | None
		evaluation_type: DF.Data | None
		full_name: DF.Data | None
		grade: DF.Literal["A", "B", "C", "D", "E"]
		graded_by: DF.Link | None
		is_published: DF.Check
		marks_obtained: DF.Float
		naming_series: DF.Literal["GRADE.-{assignment}-.###"]
		published_on: DF.Datetime | None
		remarks: DF.MarkdownEditor | None
		submission: DF.Link | None
	# end: auto-generated types

	def before_save(self):
		self.graded_by = frappe.session.user

	def validate(self):
		assignment = frappe.db.get_value(
			"CS17 Assignment", self.assignment, ["assignment_type", "max_marks"], as_dict=True
		)
		if not assignment:
			return
		if assignment.assignment_type == "Not Graded":
			frappe.throw(_("Cannot grade a Not Graded assignment."))

		max_marks = flt(assignment.max_marks)
		if flt(self.marks_obtained) < 0 or flt(self.marks_obtained) > max_marks:
			frappe.throw(_("Marks must be between 0 and {0}.").format(max_marks))


def get_student_grades(student: str, assignments: list[str]) -> dict[str, dict]:
	"""One student's submission and grade per assignment, keyed by assignment.

	A grade is reachable only through the submission it was given on, so an assignment the
	student never submitted is absent from the map.
	"""
	if not assignments:
		return {}

	submissions = frappe.get_all(
		"CS17 Assignment Submission",
		filters={"student": student, "assignment": ("in", assignments), "docstatus": ("<", 2)},
		fields=["name", "assignment"],
	)
	if not submissions:
		return {}

	by_assignment = {row.assignment: {"submission": row.name} for row in submissions}
	grades = frappe.get_all(
		"CS17 Assignment Grade",
		filters={"submission": ("in", [row.name for row in submissions])},
		fields=["assignment", "marks_obtained", "grade", "remarks"],
	)
	for grade in grades:
		if grade.assignment in by_assignment:
			by_assignment[grade.assignment].update(grade)

	return by_assignment
