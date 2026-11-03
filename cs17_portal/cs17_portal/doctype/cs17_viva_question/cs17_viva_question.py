# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class CS17VivaQuestion(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		answer: DF.SmallText
		code: DF.Code | None
		marks: DF.Int
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		question: DF.SmallText
		section: DF.Data
	# end: auto-generated types

	pass
