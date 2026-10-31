# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17Paste(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assignment: DF.Link
		character_count: DF.Int
		line_count: DF.Int
		pasted_at: DF.Datetime | None
		student: DF.Link
		text: DF.Code | None
	# end: auto-generated types

	_DOCTYPE_NAME = "CS17 Paste"
