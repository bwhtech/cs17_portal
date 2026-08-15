# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class CS17ResultSubjectScore(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		grade: DF.Data | None
		grading_scale: DF.Link | None
		is_pass: DF.Check
		marks_obtained: DF.Float
		max_marks: DF.Float
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		percentage: DF.Float
		remarks: DF.Data | None
		subject: DF.Link
		subject_name: DF.Data | None
	# end: auto-generated types

	pass
