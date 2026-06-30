# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class CS17Profile(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		address: DF.SmallText | None
		alternate_phone: DF.Data | None
		blood_group: DF.Literal["O+", "O-", "B+", "B-", "A+", "A-", "AB+", "AB-"]
		cohort: DF.Link | None
		date_of_birth: DF.Date | None
		first_name: DF.Data
		full_name: DF.Data | None
		last_name: DF.Data
		naming_series: DF.Literal["CS17-STU-{cohort}-.###", "CS17-FAC.###"]
		primary_phone: DF.Data | None
		profile_picture: DF.AttachImage | None
		profile_type: DF.Literal["Student", "Faculty"]
		user: DF.Link | None
	# end: auto-generated types

	def autoname(self):
		if self.profile_type == "Student":
			cohort = self.cohort or "GEN"
			self.name = frappe.model.naming.make_autoname(f"CS17-STU-{cohort}-.###")
		else:
			self.name = frappe.model.naming.make_autoname("CS17-FAC-.###")

	def validate(self):
		self.set_full_name()
		self.validate_one_profile_per_user()

	def set_full_name(self):
		self.full_name = " ".join(name for name in [self.first_name, self.last_name] if name)

	def validate_one_profile_per_user(self):
		# A user is either a student or faculty, never both, so they may hold only one profile.
		if not self.user:
			return

		existing = frappe.db.get_value(
			"CS17 Profile",
			{"user": self.user, "name": ["!=", self.name]},
			["name", "profile_type"],
			as_dict=True,
		)
		if existing:
			frappe.throw(
				_("{0} already has a {1} profile ({2}) and cannot have another.").format(
					frappe.bold(self.user), existing.profile_type, existing.name
				)
			)
