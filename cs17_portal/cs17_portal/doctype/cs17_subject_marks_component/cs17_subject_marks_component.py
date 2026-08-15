# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class CS17SubjectMarksComponent(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		component: DF.Data
		marks_obtained: DF.Float
		max_marks: DF.Float
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		weightage: DF.Float
	# end: auto-generated types

	pass
