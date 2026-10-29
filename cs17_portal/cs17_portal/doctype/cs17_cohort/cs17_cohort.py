# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import re

import frappe
from frappe import _
from frappe.model.document import Document


class CS17Cohort(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		cohort_code: DF.Data
		disabled: DF.Check
		start_date: DF.Date
	# end: auto-generated types

	def validate(self):
		if self.cohort_code and self.has_value_changed("cohort_code"):
			self.validate_cohort_code(self.cohort_code)

	def before_rename(self, old: str, new: str, merge: bool = False):
		self.validate_cohort_code(new)

	def validate_cohort_code(self, cohort_code: str):
		if not re.fullmatch(r"[\w\- /]+", cohort_code):
			frappe.throw(
				_(
					"Cohort Code {0} can only have letters, numbers, spaces, hyphens (-), underscores (_) and slashes (/)."
				).format(frappe.bold(cohort_code))
			)
		if cohort_code.strip().upper() == "GEN":
			frappe.throw(
				_("Cohort Code {0} is kept for students who have no cohort.").format(frappe.bold(cohort_code))
			)
