# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17PeerReview(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assignment: DF.Link
		improvement: DF.SmallText | None
		reviewer: DF.Link
		shared_on: DF.Datetime | None
		strengths: DF.SmallText | None
		submission: DF.Link
		submitted_on: DF.Datetime | None
	# end: auto-generated types

	pass
