# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class CS17Feedback(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		category: DF.Literal["Food", "Stay", "Other"]
		description: DF.SmallText
	# end: auto-generated types

	pass
