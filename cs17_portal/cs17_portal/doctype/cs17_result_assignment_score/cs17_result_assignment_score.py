# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class CS17ResultAssignmentScore(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assignment: DF.Link
		assignment_title: DF.Data | None
		assignment_type: DF.Data | None
		due_date: DF.Datetime | None
		evaluation_type: DF.Data | None
		grade: DF.Data | None
		is_submitted: DF.Check
		marks_obtained: DF.Float
		max_marks: DF.Float
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		remarks: DF.SmallText | None
	# end: auto-generated types

	pass
