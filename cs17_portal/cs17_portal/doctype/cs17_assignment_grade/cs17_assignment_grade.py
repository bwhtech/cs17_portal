# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


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
		marks_obtained: DF.Float
		naming_series: DF.Literal["GRADE.-{assignment}-.###"]
		remarks: DF.MarkdownEditor | None
		submission: DF.Link | None
	# end: auto-generated types

	def before_save(self):
		self.graded_by = frappe.session.user

	def validate(self):
		assignment_type = frappe.db.get_value("CS17 Assignment", self.assignment, "assignment_type")
		if assignment_type == "Not Graded":
			frappe.throw(_("Cannot grade a Not Graded assignment."))
