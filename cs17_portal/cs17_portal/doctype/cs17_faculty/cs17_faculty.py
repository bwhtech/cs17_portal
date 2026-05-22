# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import now_datetime


class CS17Faculty(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		full_name: DF.Data
		register_number: DF.Data | None
		user: DF.Link | None
	# end: auto-generated types

	def autoname(self):
		year_suffix = str(now_datetime().year)[-2:]  # 2026 → "26"
		prefix = f"CS17F{year_suffix}"  # → "CS17F26"
		self.name = make_autoname(f"{prefix}.###")
		self.register_number = self.name
