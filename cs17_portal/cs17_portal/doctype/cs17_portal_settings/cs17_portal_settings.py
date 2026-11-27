# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import to_timedelta


class CS17PortalSettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_quick_link.cs17_quick_link import CS17QuickLink

		daily_activity_email: DF.Check
		practice_hours_end: DF.Time
		practice_hours_start: DF.Time
		quick_links: DF.Table[CS17QuickLink]
	# end: auto-generated types

	def validate(self):
		if to_timedelta(self.practice_hours_end) <= to_timedelta(self.practice_hours_start):
			frappe.throw(_("Practice hours must end after they start."))
