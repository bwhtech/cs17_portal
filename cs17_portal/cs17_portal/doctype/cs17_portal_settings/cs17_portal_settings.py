# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17PortalSettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from cs17_portal.cs17_portal.doctype.cs17_quick_link.cs17_quick_link import CS17QuickLink
		from frappe.types import DF

		quick_links: DF.Table[CS17QuickLink]
	# end: auto-generated types

	pass
