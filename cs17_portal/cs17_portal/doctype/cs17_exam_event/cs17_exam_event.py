# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CS17ExamEvent(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assignment: DF.Link | None
		detail: DF.SmallText | None
		exam: DF.Link
		kind: DF.Literal[
			"tab_leave",
			"window_blur",
			"fullscreen_exit",
			"paste_blocked",
			"paste",
			"copy_question",
			"split_screen",
			"second_screen",
			"second_login",
			"code_jump",
			"rule_action",
		]
		occurred_at: DF.Datetime
		seconds: DF.Float
		student: DF.Link
	# end: auto-generated types

	pass
