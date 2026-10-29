# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, get_datetime

from cs17_portal.api import is_published_now
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import notify_students
from cs17_portal.cs17_portal.doctype.cs17_grading_scale.cs17_grading_scale import get_default_scale

LETTER_GRADES = ("A", "B", "C", "D", "E")


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
		grade: DF.Data | None
		graded_by: DF.Link | None
		is_published: DF.Check
		marks_obtained: DF.Float
		naming_series: DF.Literal["GRADE-.{assignment}.-.###"]
		published_on: DF.Datetime | None
		remarks: DF.MarkdownEditor | None
		submission: DF.Link | None
	# end: auto-generated types

	def before_save(self):
		grading_fields = ["marks_obtained", "remarks"]
		if self.evaluation_type != "Marks":
			grading_fields.append("grade")
		if any(self.has_value_changed(field) for field in grading_fields):
			self.graded_by = frappe.session.user

	def validate(self):
		self.remarks = (self.remarks or "").strip() or None
		self.escape_tags_in_remarks()
		self.validate_duplicate()
		assignment = frappe.db.get_value(
			"CS17 Assignment", self.assignment, ["assignment_type", "max_marks", "remarks"], as_dict=True
		)
		if not assignment:
			return
		if assignment.assignment_type == "Not Graded" and not self.remarks:
			frappe.throw(_("Enter the remarks."))

		max_marks = flt(assignment.max_marks)
		if flt(self.marks_obtained) < 0 or flt(self.marks_obtained) > max_marks:
			frappe.throw(_("Marks must be between 0 and {0}.").format(max_marks))

		if assignment.remarks == "Marks":
			self.grade = get_grade_for_marks(flt(self.marks_obtained), max_marks, get_default_scale())
		elif self.grade and self.grade not in LETTER_GRADES:
			frappe.throw(_("Grade must be one of {0}.").format(", ".join(LETTER_GRADES)))

	def validate_duplicate(self):
		if not self.submission:
			return
		duplicate = frappe.db.exists(
			"CS17 Assignment Grade", {"submission": self.submission, "name": ("!=", self.name)}
		)
		if duplicate:
			frappe.throw(_("Grade {0} already exists for this submission.").format(duplicate))

	def escape_tags_in_remarks(self):
		if self.remarks:
			self.remarks = re.sub(r"<(?=/?[a-zA-Z])", "&lt;", self.remarks)

	def on_update(self):
		if self.published_on:
			self.published_on = get_datetime(self.published_on)
		previous = self.get_doc_before_save()
		if is_published_now(self, "published_on") or (
			previous and is_published_now(previous, "published_on")
		):
			self.refresh_results()
		if self.submission and self.is_published and self.has_value_changed("is_published"):
			frappe.enqueue(
				notify_students,
				assignment=self.assignment,
				students=[frappe.db.get_value("CS17 Assignment Submission", self.submission, "student")],
				subject=(_("Graded: {0}") if self.evaluation_type else _("New remarks: {0}")).format(
					self.assignment_title
				),
				enqueue_after_commit=True,
			)

	def refresh_results(self):
		if not self.submission:
			return
		student = frappe.db.get_value("CS17 Assignment Submission", self.submission, "student")
		results = frappe.get_all(
			"CS17 Result",
			filters={"student": student, "assignments.assignment": self.assignment},
			pluck="name",
		)
		for result in results:
			frappe.get_doc("CS17 Result", result).save(ignore_permissions=True)


def get_grade_for_marks(marks_obtained: float, max_marks: float, scale: str | None) -> str | None:
	if not scale:
		return None
	percentage = flt(marks_obtained * 100 / max_marks, 2) if max_marks else 0
	return frappe.get_cached_doc("CS17 Grading Scale", scale).get_grade(percentage)


def get_student_grades(student: str, assignments: list[str]) -> dict[str, dict]:
	"""One student's submission and published grade per assignment, keyed by assignment.

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
		fields=[
			"name as grade_name",
			"assignment",
			"marks_obtained",
			"grade",
			"remarks",
			"is_published",
			"published_on",
		],
	)
	for grade in grades:
		if grade.assignment in by_assignment and is_published_now(grade, "published_on"):
			by_assignment[grade.assignment].update(grade)

	return by_assignment
