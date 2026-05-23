# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import now_datetime


class CS17Faculty(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		first_name: DF.Data
		full_name: DF.Data | None
		last_name: DF.Data
		naming_series: DF.Literal[None]
		user: DF.Link | None
	# end: auto-generated types
