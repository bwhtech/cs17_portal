# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
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
		naming_series: DF.Literal["GRADE-.###"]
		remarks: DF.MarkdownEditor | None
		submission: DF.Link | None
	# end: auto-generated types

	pass
