# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname


class CS17Student(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		address: DF.SmallText | None
		blood_group: DF.Literal["O+", "O-", "B+", "B-", "A+", "A-", "AB+", "AB-"]
		cohort: DF.Link
		date_of_birth: DF.Date | None
		first_name: DF.Data
		full_name: DF.Data | None
		last_name: DF.Data
		naming_series: DF.Literal["CS17.{cohort}.YYYY.###"]
		profile_picture: DF.AttachImage | None
		user: DF.Link | None
	# end: auto-generated types

	def validate(self):
		self.full_name = " ".join([name for name in [self.first_name, self.last_name] if name])
