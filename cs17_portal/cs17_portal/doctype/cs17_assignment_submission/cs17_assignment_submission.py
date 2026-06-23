# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17AssignmentSubmission(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amended_from: DF.Link | None
		assignment: DF.Link
		assignment_title: DF.Data | None
		full_name: DF.Data | None
		naming_series: DF.Literal["SUB.-.{assignment}.-.###"]
		student: DF.Link
		submission_document: DF.Attach
		submitted_at: DF.Datetime | None
	# end: auto-generated types

	pass
