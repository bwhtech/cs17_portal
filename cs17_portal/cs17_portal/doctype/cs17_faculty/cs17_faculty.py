# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CS17Faculty(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		first_name: DF.Data
		full_name: DF.Data | None
		last_name: DF.Data
		naming_series: DF.Literal["CS17FAC.###"]
		user: DF.Link | None
	# end: auto-generated types
	
	def before_save(self):
		self.full_name = f"{self.first_name} {self.last_name}"

