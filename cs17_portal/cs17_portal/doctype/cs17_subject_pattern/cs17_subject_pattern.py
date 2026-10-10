# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

TOTAL_WEIGHTAGE = 100
WEIGHTAGE_TOLERANCE = 0.01


class CS17SubjectPattern(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_subject_pattern_component.cs17_subject_pattern_component import (
			CS17SubjectPatternComponent,
		)

		components: DF.Table[CS17SubjectPatternComponent]
		description: DF.SmallText | None
		pattern_name: DF.Data
		total_weightage: DF.Float
	# end: auto-generated types

	def validate(self):
		self.validate_components()
		self.total_weightage = sum(flt(row.weightage) for row in self.components)
		if abs(self.total_weightage - TOTAL_WEIGHTAGE) > WEIGHTAGE_TOLERANCE:
			frappe.throw(
				_("Weightages add up to {0}%, they must add up to 100%.").format(self.total_weightage)
			)
		self.validate_locked_after_marks()

	def validate_components(self):
		if not self.components:
			frappe.throw(_("At least one component is required."))

		seen = set()
		for row in self.components:
			name = (row.component or "").strip()
			if not name:
				frappe.throw(_("Every component needs a name."))
			if name in seen:
				frappe.throw(_("Component {0} is listed more than once.").format(name))
			if flt(row.weightage) <= 0:
				frappe.throw(_("Component {0}: weightage must be greater than zero.").format(name))
			row.component = name
			seen.add(name)

	def validate_locked_after_marks(self):
		previous = self.get_doc_before_save()
		if not previous:
			return
		if self.component_signature(previous.components) == self.component_signature(self.components):
			return
		if frappe.db.exists("CS17 Subject Marks", {"subject_pattern": self.name}):
			frappe.throw(
				_(
					"Marks are already recorded with this pattern; its components and weightages cannot change."
				)
			)

	@staticmethod
	def component_signature(rows) -> set:
		return {(row.component, flt(row.weightage)) for row in rows}


def get_component_rows(pattern: str) -> list[dict]:
	return frappe.get_all(
		"CS17 Subject Pattern Component",
		filters={"parent": pattern, "parenttype": "CS17 Subject Pattern"},
		fields=["component", "weightage"],
		order_by="idx asc",
	)
