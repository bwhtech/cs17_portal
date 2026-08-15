# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class CS17ExamSubject(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		examiner: DF.Link | None
		grading_scale: DF.Link | None
		max_marks: DF.Float
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		subject: DF.Link
		subject_name: DF.Data | None
		subject_pattern: DF.Link | None
	# end: auto-generated types

	pass
