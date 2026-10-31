# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class CS17Project(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assignment: DF.Link | None
		code: DF.Code | None
		last_saved_at: DF.Datetime | None
		profile: DF.Link
		project_title: DF.Data
		project_type: DF.Literal["Scratch", "Python"]
		sb3_file: DF.Attach | None
		thumbnail: DF.AttachImage | None
	# end: auto-generated types

	def record_tab_leave(self):
		self._require_watched_assignment()
		frappe.get_doc(
			{
				"doctype": "CS17 Tab Leave",
				"assignment": self.assignment,
				"student": self.profile,
				"left_at": now_datetime(),
			}
		).insert(ignore_permissions=True)

	def record_tab_return(self):
		self._require_watched_assignment()
		leave = frappe.db.get_value(
			"CS17 Tab Leave",
			{"assignment": self.assignment, "student": self.profile, "returned_at": ("is", "not set")},
			"name",
			order_by="left_at desc",
		)
		if leave:
			frappe.db.set_value("CS17 Tab Leave", leave, "returned_at", now_datetime())

	def _require_watched_assignment(self):
		if not (
			self.assignment and frappe.db.get_value("CS17 Assignment", self.assignment, "watch_tab_switches")
		):
			frappe.throw(_("This assignment does not watch tab switches."))

	def on_trash(self):
		frappe.db.delete("CS17 Code Snapshot", {"project": self.name})


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
	if profile:
		return f"`tabCS17 Project`.profile = {frappe.db.escape(profile.name)}"
	return "1 = 0"


def has_permission(doc: Document, ptype: str | None = None, user: str | None = None) -> bool:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return True

	profile = get_owner_profile(user)
	return bool(profile and doc.profile == profile.name)
