# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class CS17GradingScale(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_grade_band.cs17_grade_band import CS17GradeBand

		bands: DF.Table[CS17GradeBand]
		is_default: DF.Check
		passing_percentage: DF.Float
		scale_name: DF.Data
	# end: auto-generated types

	def validate(self):
		self.validate_passing_percentage()
		self.validate_bands()

	def on_update(self):
		if self.is_default:
			self.clear_other_defaults()

	def validate_passing_percentage(self):
		if not 0 <= flt(self.passing_percentage) <= 100:
			frappe.throw(_("Passing percentage must be between 0 and 100."))

	def validate_bands(self):
		if not self.bands:
			frappe.throw(_("At least one grade band is required."))

		self.bands.sort(key=lambda band: flt(band.min_percent))
		seen_grades = set()
		previous = None

		for index, band in enumerate(self.bands, start=1):
			band.idx = index
			minimum, maximum = flt(band.min_percent), flt(band.max_percent)
			if not 0 <= minimum <= 100 or not 0 <= maximum <= 100:
				frappe.throw(_("Band {0}: percentages must be between 0 and 100.").format(band.grade))
			if minimum >= maximum:
				frappe.throw(_("Band {0}: minimum must be lower than maximum.").format(band.grade))
			if band.grade in seen_grades:
				frappe.throw(_("Grade {0} is defined more than once.").format(band.grade))
			if previous and minimum <= flt(previous.max_percent):
				frappe.throw(_("Bands {0} and {1} overlap.").format(previous.grade, band.grade))
			seen_grades.add(band.grade)
			previous = band

		if flt(self.bands[0].min_percent) != 0:
			frappe.throw(_("The lowest band must start at 0%."))
		if flt(self.bands[-1].max_percent) != 100:
			frappe.throw(_("The highest band must end at 100%."))

	def clear_other_defaults(self):
		Scale = frappe.qb.DocType("CS17 Grading Scale")
		(
			frappe.qb.update(Scale)
			.set(Scale.is_default, 0)
			.where((Scale.is_default == 1) & (Scale.name != self.name))
		).run()

	def get_band(self, percentage: float) -> "CS17GradeBand | None":
		"""Return the highest band whose minimum is at or below the given percentage."""
		candidates = [band for band in self.bands if flt(percentage) >= flt(band.min_percent)]
		return max(candidates, key=lambda band: flt(band.min_percent)) if candidates else None

	def get_grade(self, percentage: float) -> str:
		band = self.get_band(percentage)
		return band.grade if band else ""

	def is_pass(self, percentage: float) -> bool:
		return flt(percentage) >= flt(self.passing_percentage)


def get_default_scale() -> str | None:
	return frappe.db.get_value("CS17 Grading Scale", {"is_default": 1}, "name")
