# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class CS17ExplanationRequest(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		answered_on: DF.Datetime | None
		question: DF.SmallText | None
		requested_on: DF.Datetime | None
		submission: DF.Link
		voice_note: DF.Attach | None
	# end: auto-generated types

	_DOCTYPE_NAME = "CS17 Explanation Request"

	def validate(self):
		if not self.answered_on and frappe.db.exists(
			self.doctype,
			{"submission": self.submission, "answered_on": ("is", "not set"), "name": ("!=", self.name)},
		):
			frappe.throw(_("An explanation is already requested."))
