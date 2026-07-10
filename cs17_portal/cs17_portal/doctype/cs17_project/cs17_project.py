# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CS17Project(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		last_saved_at: DF.Datetime | None
		project_title: DF.Data
		sb3_file: DF.Attach | None
		student: DF.Link
		thumbnail: DF.AttachImage | None
	# end: auto-generated types

	pass


def get_owner_profile(user: str) -> frappe._dict | None:
	return frappe.db.get_value(
		"CS17 Profile",
		{"user": user},
		["name", "profile_type"],
		as_dict=True,
	)


def get_permission_query_conditions(user: str | None = None) -> str:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return ""

	profile = get_owner_profile(user)
	if profile and profile.profile_type == "Student":
		return f"`tabCS17 Project`.student = {frappe.db.escape(profile.name)}"
	return "1 = 0"


def has_permission(doc: Document, ptype: str | None = None, user: str | None = None) -> bool:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return True

	profile = get_owner_profile(user)
	return bool(profile and profile.profile_type == "Student" and doc.student == profile.name)
