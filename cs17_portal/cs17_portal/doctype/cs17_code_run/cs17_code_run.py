# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17CodeRun(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assignment: DF.Link
		error_line: DF.Int
		error_type: DF.Data | None
		passed: DF.Int
		ran_at: DF.Datetime | None
		student: DF.Link
		total: DF.Int
	# end: auto-generated types

	_DOCTYPE_NAME = "CS17 Code Run"
