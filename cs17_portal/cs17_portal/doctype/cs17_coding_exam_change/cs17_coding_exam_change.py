# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17CodingExamChange(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		change: DF.SmallText
		changed_by: DF.Link | None
		changed_on: DF.Datetime | None
		exam: DF.Link
		student: DF.Link | None
	# end: auto-generated types

	pass
