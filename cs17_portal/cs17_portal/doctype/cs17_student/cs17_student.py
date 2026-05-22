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
		full_name: DF.Data
		profile_picture: DF.AttachImage | None
		register_number: DF.Data | None
		user: DF.Link | None
	# end: auto-generated types

	def autoname(self):
		cohort = frappe.get_doc("CS17 Cohort", self.cohort)
		cohort_code = cohort.cohort_code  # e.g. "C0"
		year_suffix = str(cohort.start_year)[-2:]  # "2026" → "26"
		prefix = f"CS17{cohort_code}{year_suffix}"  # → "CS17C026"
		self.name = make_autoname(f"{prefix}.###")
		self.register_number = self.name
