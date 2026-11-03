# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_to_date, cint, get_datetime, now_datetime, time_diff_in_seconds


class CS17CodingExamAttempt(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_coding_exam_attempt_question.cs17_coding_exam_attempt_question import (
			CS17CodingExamAttemptQuestion,
		)

		ends_at: DF.Datetime | None
		exam: DF.Link
		extra_minutes: DF.Int
		finished_on: DF.Datetime | None
		paused_at: DF.Datetime | None
		paused_seconds: DF.Int
		questions: DF.Table[CS17CodingExamAttemptQuestion]
		started_at: DF.Datetime
		student: DF.Link
	# end: auto-generated types

	def validate(self):
		exam = frappe.db.get_value(
			"CS17 Coding Exam", self.exam, ["duration_minutes", "closes_on"], as_dict=True
		)
		ends_at = add_to_date(
			get_datetime(self.started_at),
			minutes=cint(exam.duration_minutes) + cint(self.extra_minutes),
			seconds=cint(self.paused_seconds),
		)
		self.ends_at = min(ends_at, get_datetime(exam.closes_on))

	def add_time(self, minutes: int):
		self.extra_minutes = cint(self.extra_minutes) + minutes
		self.save(ignore_permissions=True)

	def pause(self):
		self.paused_at = now_datetime()
		self.save(ignore_permissions=True)

	def resume(self):
		self.paused_seconds = cint(self.paused_seconds) + cint(
			time_diff_in_seconds(now_datetime(), self.paused_at)
		)
		self.paused_at = None
		self.save(ignore_permissions=True)

	def finish(self):
		from cs17_portal.api import ASSIGNMENT_SUBMISSION, submit_python_code
		from cs17_portal.coding_exam import get_projects

		assignments = frappe.get_all(
			"CS17 Coding Exam Question",
			filters={"parent": self.exam, "parenttype": "CS17 Coding Exam"},
			pluck="assignment",
			order_by="idx asc",
		)
		submitted_code = dict(
			frappe.get_all(
				ASSIGNMENT_SUBMISSION,
				filters={"student": self.student, "assignment": ["in", assignments]},
				fields=["assignment", "code"],
				as_list=True,
			)
		)
		for assignment, project in get_projects(self.student, assignments).items():
			project_doc = frappe.get_doc("CS17 Project", project)
			if (project_doc.code or "").strip() and project_doc.code != submitted_code.get(assignment):
				submit_python_code(assignment, self.student, project_doc, ignore_deadline=True)
		self.finished_on = now_datetime()
		self.save(ignore_permissions=True)
