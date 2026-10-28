# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17AISettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		api_key: DF.Password | None
		model: DF.Data | None
	# end: auto-generated types

	_DOCTYPE_NAME = "CS17 AI Settings"

	def is_set_up(self) -> bool:
		return bool(self.model and self.api_key)
