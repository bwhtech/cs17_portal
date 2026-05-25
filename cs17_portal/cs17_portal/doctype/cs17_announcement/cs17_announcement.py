# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17Announcement(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		cohort: DF.Link | None
		content: DF.MarkdownEditor
		is_published: DF.Check
		published_date: DF.Date | None
		title: DF.Data
	# end: auto-generated types

	pass
