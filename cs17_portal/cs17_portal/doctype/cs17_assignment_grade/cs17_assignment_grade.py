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
		graded_by: DF.Link | None
		max_marks: DF.Float
		naming_series: DF.Literal["GRADE-.###"]
		remarks: DF.SmallText | None
		submission: DF.Link | None
	# end: auto-generated types

	pass
