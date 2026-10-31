# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class CS17CodeComment(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		comment: DF.SmallText
		line: DF.Int
		submission: DF.Link
		submitted_at: DF.Datetime | None
	# end: auto-generated types

	_DOCTYPE_NAME = "CS17 Code Comment"

	def validate(self):
		self.comment = (self.comment or "").strip()
		if not self.comment:
			frappe.throw(_("Write a comment."))
