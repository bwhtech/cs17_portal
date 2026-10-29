# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17SubmissionRevision(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		code: DF.Code | None
		grade: DF.Data | None
		graded_by: DF.Link | None
		marks_obtained: DF.Float
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		reason: DF.SmallText | None
		remarks: DF.MarkdownEditor | None
		returned_by: DF.Link | None
		returned_on: DF.Datetime | None
		submission_document: DF.Attach | None
		submission_url: DF.Data | None
		submitted_at: DF.Datetime | None
	# end: auto-generated types

	_DOCTYPE_NAME = "CS17 Submission Revision"
