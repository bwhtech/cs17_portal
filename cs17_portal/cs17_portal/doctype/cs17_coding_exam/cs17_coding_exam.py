# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, get_datetime


class CS17CodingExam(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_coding_exam_question.cs17_coding_exam_question import (
			CS17CodingExamQuestion,
		)

		banner: DF.SmallText | None
		can_go_back: DF.Check
		closes_on: DF.Datetime
		cohort: DF.Link
		duration_minutes: DF.Int
		instructions: DF.TextEditor | None
		is_published: DF.Check
		last_start_on: DF.Datetime
		opens_on: DF.Datetime
		quarter: DF.Link | None
		question_order: DF.Literal["Any order", "One by one"]
		questions: DF.Table[CS17CodingExamQuestion]
		title: DF.Data
	# end: auto-generated types

	def validate(self):
		if cint(self.duration_minutes) <= 0:
			frappe.throw(_("Give the exam a duration above 0 minutes."))
		if get_datetime(self.last_start_on) <= get_datetime(self.opens_on):
			frappe.throw(_("The last start time must be after the open time."))
		if get_datetime(self.closes_on) < get_datetime(self.last_start_on):
			frappe.throw(_("The close time cannot be before the last start time."))
		if self.is_published and not self.questions:
			frappe.throw(_("Add at least one question before publishing the exam."))
		self._validate_questions()
		self._validate_started_exam_kept()

	def _validate_questions(self):
		names = [row.assignment for row in self.questions]
		assignments = {
			assignment.name: assignment
			for assignment in frappe.get_all(
				"CS17 Assignment",
				filters={"name": ["in", names]},
				fields=["name", "title", "cohort", "submission_type", "coding_exam"],
			)
		}
		with_tests = set(
			frappe.get_all(
				"CS17 Python Test Case",
				filters={
					"parent": ["in", names],
					"parenttype": "CS17 Assignment",
					"parentfield": "test_cases",
				},
				pluck="parent",
			)
		)
		for index, row in enumerate(self.questions):
			assignment = assignments[row.assignment]
			if row.assignment in names[:index]:
				frappe.throw(_("{0} is listed more than once.").format(assignment.title))
			if assignment.submission_type != "Python":
				frappe.throw(_("{0} is not a Python assignment.").format(assignment.title))
			if assignment.cohort != self.cohort:
				frappe.throw(_("{0} belongs to another cohort.").format(assignment.title))
			if row.assignment not in with_tests:
				frappe.throw(_("{0} has no test cases.").format(assignment.title))
			if assignment.coding_exam not in (None, "", self.name):
				frappe.throw(_("{0} is already in another exam.").format(assignment.title))
			if flt(row.marks) <= 0:
				frappe.throw(_("Give {0} marks above 0.").format(assignment.title))

	def _validate_started_exam_kept(self):
		previous = self.get_doc_before_save()
		if not previous or not frappe.db.exists("CS17 Coding Exam Attempt", {"exam": self.name}):
			return
		started_with = [row.assignment for row in previous.questions]
		if [row.assignment for row in self.questions][: len(started_with)] != started_with:
			frappe.throw(
				_("Students have started this exam, so its questions cannot be removed or reordered.")
			)
		if previous.is_published and not self.is_published:
			frappe.throw(_("Students have started this exam, so it cannot be unpublished."))

	def on_update(self):
		self._link_questions()
		previous = self.get_doc_before_save()
		if previous and (
			cint(previous.duration_minutes) != cint(self.duration_minutes)
			or get_datetime(previous.closes_on) != get_datetime(self.closes_on)
		):
			for name in frappe.get_all(
				"CS17 Coding Exam Attempt",
				filters={"exam": self.name, "finished_on": ["is", "not set"]},
				pluck="name",
			):
				frappe.get_doc("CS17 Coding Exam Attempt", name).save(ignore_permissions=True)

	def _link_questions(self):
		linked = set(frappe.get_all("CS17 Assignment", filters={"coding_exam": self.name}, pluck="name"))
		questions = {row.assignment for row in self.questions}
		for assignment in linked - questions:
			frappe.db.set_value("CS17 Assignment", assignment, "coding_exam", None, update_modified=False)
		for assignment in questions - linked:
			frappe.db.set_value(
				"CS17 Assignment", assignment, "coding_exam", self.name, update_modified=False
			)
