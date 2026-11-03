# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CS17VivaMark(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		marks_obtained: DF.Float
		question: DF.Data
		student: DF.Link
		student_name: DF.Data | None
		viva: DF.Link
	# end: auto-generated types

	pass


def on_doctype_update():
	frappe.db.add_unique("CS17 Viva Mark", ["viva", "student", "question"])
