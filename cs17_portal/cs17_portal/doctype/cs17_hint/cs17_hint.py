# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17Hint(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		asked_at: DF.Datetime | None
		assignment: DF.Link
		code: DF.LongText | None
		hint: DF.SmallText | None
		student: DF.Link
	# end: auto-generated types

	pass
