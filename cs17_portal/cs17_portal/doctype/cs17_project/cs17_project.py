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
		["name", "profile_type", "cohort"],
		as_dict=True,
	)


def get_permission_query_conditions(user: str | None = None) -> str:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return ""

	profile = get_owner_profile(user)
	if not profile:
		return "1 = 0"

	if profile.profile_type == "Student":
		return f"`tabCS17 Project`.student = {frappe.db.escape(profile.name)}"

	# Faculty may read every project belonging to a student in their cohort.
	if profile.cohort:
		return (
			"`tabCS17 Project`.student in "
			f"(select name from `tabCS17 Profile` where cohort = {frappe.db.escape(profile.cohort)})"
		)
	return "1 = 0"


# `ptype` is the parameter name Frappe's has_permission hook passes (framework contract), so it must
# match exactly for the permission type to bind.
def has_permission(doc: Document, ptype: str | None = None, user: str | None = None) -> bool:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return True

	profile = get_owner_profile(user)
	if not profile:
		return False

	if profile.profile_type == "Student":
		return doc.student == profile.name

	# Faculty get read-only access, scoped to their own cohort.
	if ptype not in (None, "read", "select", "report", "export", "print", "email", "share"):
		return False
	student_cohort = frappe.db.get_value("CS17 Profile", doc.student, "cohort")
	return bool(profile.cohort) and student_cohort == profile.cohort
