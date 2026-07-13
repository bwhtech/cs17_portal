# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class CS17Assignment(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assignment_type: DF.Literal["Graded", "Not Graded"]
		cohort: DF.Link
		description: DF.TextEditor | None
		due_date: DF.Datetime
		is_published: DF.Check
		max_marks: DF.Float
		naming_series: DF.Literal["GRADED-.{cohort}.-.###", "NOT-GRADED-.{cohort}.-.###"]
		publish_on: DF.Datetime | None
		remarks: DF.Literal["Grade", "Marks"]
		submission_type: DF.Literal["Any", "PDF", "URL", "Image", "ZIP", "Scratch"]
		title: DF.Data
	# end: auto-generated types

	def before_insert(self):
		from cs17_portal.api import validate_membership

		validate_membership("Faculty")

	def validate(self):
		if self.assignment_type == "Not Graded":
			self.max_marks = 0
			self.remarks = ""
		self._validate_publishable()
