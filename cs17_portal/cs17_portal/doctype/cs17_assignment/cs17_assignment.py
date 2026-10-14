# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, get_datetime


class CS17Assignment(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_python_test_case.cs17_python_test_case import (
			CS17PythonTestCase,
		)

		answer_sheet: DF.JSON | None
		assignment_type: DF.Literal["Graded", "Not Graded"]
		cohort: DF.Link | None
		description: DF.TextEditor | None
		due_date: DF.Datetime | None
		is_published: DF.Check
		max_marks: DF.Float
		naming_series: DF.Literal["GRADED-.{cohort}.-.###", "NOT-GRADED-.{cohort}.-.###"]
		publish_on: DF.Datetime | None
		quarter: DF.Link | None
		remarks: DF.Literal["Grade", "Marks"]
		show_answers: DF.Check
		starter_code: DF.Code | None
		submission_type: DF.Literal["Any", "PDF", "URL", "Image", "ZIP", "Scratch", "Python"]
		test_cases: DF.Table[CS17PythonTestCase]
		title: DF.Data
	# end: auto-generated types

	def before_insert(self):
		from cs17_portal.api import validate_membership

		if "System Manager" not in frappe.get_roles(frappe.session.user):
			validate_membership("Faculty")

	def validate(self):
		if self.submission_type != "Python":
			self.starter_code = None
			self.test_cases = []
		if self.assignment_type == "Not Graded":
			self.max_marks = 0
			self.remarks = ""
		elif not self.remarks:
			frappe.throw(_("Choose an Evaluation Type, Grade or Marks, for a graded assignment"))
		self.is_published = cint(self.is_published)
		self._validate_publishable()
		self._validate_stays_published()
		self._validate_evaluation_type_locked()
		self._validate_max_marks_not_below_marks_given()

	def _validate_publishable(self):
		if not (self.is_published or self.publish_on):
			return
		if not self.cohort:
			frappe.throw(_("A cohort is required to publish an assignment"))
		if not self.due_date:
			frappe.throw(_("A due date is required to publish an assignment"))
		if self.remarks == "Marks" and flt(self.max_marks) <= 0:
			frappe.throw(_("Max marks are required to publish an assignment"))

	def _validate_stays_published(self):
		from cs17_portal.api import is_published_now

		if self.publish_on:
			self.publish_on = get_datetime(self.publish_on)
		previous = self.get_doc_before_save()
		if previous and is_published_now(previous) and not is_published_now(self):
			frappe.throw(_("A published assignment cannot be unpublished"))

	def _validate_evaluation_type_locked(self):
		previous = self.get_doc_before_save()
		if not previous or previous.remarks == self.remarks:
			return
		if frappe.db.exists("CS17 Assignment Grade", {"assignment": self.name, "marks_obtained": (">", 0)}):
			frappe.throw(_("This assignment already has marks; its evaluation type cannot change."))

	def _validate_max_marks_not_below_marks_given(self):
		previous = self.get_doc_before_save()
		max_marks = flt(self.max_marks)
		if not previous or flt(previous.max_marks) == max_marks:
			return
		if frappe.db.exists(
			"CS17 Assignment Grade", {"assignment": self.name, "marks_obtained": (">", max_marks)}
		):
			frappe.throw(
				_("This assignment already has marks above {0}; its max marks cannot go below them.").format(
					max_marks
				)
			)


def get_quarter_assignments(quarter: str, cohort: str) -> list[dict]:
	"""Published assignments of one quarter for one cohort, in the order they fell due."""
	from cs17_portal.api import is_published_now

	assignments = frappe.get_all(
		"CS17 Assignment",
		filters={"quarter": quarter, "cohort": cohort},
		fields=[
			"name",
			"title",
			"assignment_type",
			"remarks as evaluation_type",
			"max_marks",
			"due_date",
			"is_published",
			"publish_on",
		],
		order_by="due_date asc, creation asc",
	)
	return [assignment for assignment in assignments if is_published_now(assignment)]
