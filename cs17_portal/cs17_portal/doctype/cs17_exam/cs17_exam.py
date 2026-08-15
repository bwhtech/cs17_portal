# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate

from cs17_portal.cs17_portal.doctype.cs17_grading_scale.cs17_grading_scale import get_default_scale


class CS17Exam(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_exam_subject.cs17_exam_subject import CS17ExamSubject

		cohort: DF.Link
		end_date: DF.Date | None
		exam_name: DF.Data
		grading_scale: DF.Link
		naming_series: DF.Literal["EXAM-.{cohort}.-.###"]
		start_date: DF.Date | None
		subjects: DF.Table[CS17ExamSubject]
		total_max_marks: DF.Float
	# end: auto-generated types

	def validate(self):
		self.grading_scale = self.grading_scale or get_default_scale()
		self.validate_dates()
		self.validate_subjects()
		self.validate_locked_after_publish()
		self.validate_locked_after_marks()
		self.total_max_marks = sum(flt(row.max_marks) for row in self.subjects)

	def validate_dates(self):
		if self.start_date and self.end_date and getdate(self.end_date) < getdate(self.start_date):
			frappe.throw(_("End date cannot be before start date."))

	def validate_subjects(self):
		if not self.subjects:
			frappe.throw(_("At least one subject is required."))

		seen = set()
		for row in self.subjects:
			if row.subject in seen:
				frappe.throw(_("Subject {0} is listed more than once.").format(row.subject))
			if flt(row.max_marks) <= 0:
				frappe.throw(_("Subject {0}: max marks must be greater than zero.").format(row.subject))
			row.grading_scale = row.grading_scale or self.grading_scale
			seen.add(row.subject)

	def validate_locked_after_publish(self):
		"""Published results carry a copy of these marks, so the paper set must stop moving."""
		if self.is_new() or not frappe.db.exists("CS17 Result", {"exam": self.name, "is_published": 1}):
			return
		if self.subject_signature(get_subject_rows(self.name)) != self.subject_signature(self.subjects):
			frappe.throw(_("Subjects cannot be changed once results for this exam are published."))

	def validate_locked_after_marks(self):
		"""Component max marks come from the pattern and the subject total, so neither can move
		once marks have actually been recorded against them."""
		if self.is_new():
			return

		previous = {row.subject: row for row in get_subject_rows(self.name)}
		for row in self.subjects:
			old = previous.get(row.subject)
			if not old:
				continue
			if (old.subject_pattern, flt(old.max_marks)) == (row.subject_pattern, flt(row.max_marks)):
				continue
			if frappe.db.exists(
				"CS17 Subject Marks",
				{"exam": self.name, "subject": row.subject, "total_marks_obtained": (">", 0)},
			):
				frappe.throw(
					_("Marks are already recorded for {0}; its pattern and max marks cannot change.").format(
						row.subject
					)
				)

	@staticmethod
	def subject_signature(rows) -> set:
		return {(row.subject, flt(row.max_marks), row.grading_scale, row.subject_pattern) for row in rows}


def get_subject_rows(exam: str) -> list[dict]:
	return frappe.get_all(
		"CS17 Exam Subject",
		filters={"parent": exam, "parenttype": "CS17 Exam"},
		fields=["subject", "subject_name", "max_marks", "grading_scale", "examiner", "subject_pattern"],
		order_by="idx asc",
	)
