# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from cs17_portal.cs17_portal.doctype.cs17_exam.cs17_exam import get_subject_rows
from cs17_portal.cs17_portal.doctype.cs17_subject_pattern.cs17_subject_pattern import get_component_rows

WHOLE_SUBJECT = "Total"


class CS17SubjectMarks(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_subject_marks_component.cs17_subject_marks_component import (
			CS17SubjectMarksComponent,
		)

		cohort: DF.Link | None
		components: DF.Table[CS17SubjectMarksComponent]
		exam: DF.Link
		grade: DF.Data | None
		grading_scale: DF.Link | None
		is_pass: DF.Check
		max_marks: DF.Float
		naming_series: DF.Literal["SM-.{exam}.-.###"]
		percentage: DF.Float
		student: DF.Link
		student_name: DF.Data | None
		subject: DF.Link
		subject_name: DF.Data | None
		subject_pattern: DF.Link | None
		total_marks_obtained: DF.Float
	# end: auto-generated types

	def validate(self):
		self.set_exam_subject_context()
		self.validate_student()
		self.validate_duplicate()
		self.sync_components_with_pattern()
		self.calculate()

	def set_exam_subject_context(self):
		"""The exam's subject row owns the max marks, the pattern and the grading scale."""
		exam_row = next((row for row in get_subject_rows(self.exam) if row.subject == self.subject), None)
		if not exam_row:
			frappe.throw(_("Subject {0} is not part of exam {1}.").format(self.subject, self.exam))

		self.max_marks = exam_row.max_marks
		self.subject_pattern = exam_row.subject_pattern
		self.grading_scale = exam_row.grading_scale or frappe.db.get_value(
			"CS17 Exam", self.exam, "grading_scale"
		)

	def validate_student(self):
		profile = frappe.db.get_value("CS17 Profile", self.student, ["profile_type", "cohort"], as_dict=True)
		if not profile or profile.profile_type != "Student":
			frappe.throw(_("{0} is not a student profile.").format(self.student))

		exam_cohort = frappe.db.get_value("CS17 Exam", self.exam, "cohort")
		if profile.cohort != exam_cohort:
			frappe.throw(_("{0} does not belong to the cohort of this exam.").format(self.student))
		self.cohort = profile.cohort

	def validate_duplicate(self):
		duplicate = frappe.db.exists(
			"CS17 Subject Marks",
			{"exam": self.exam, "student": self.student, "subject": self.subject, "name": ("!=", self.name)},
		)
		if duplicate:
			frappe.throw(_("Marks {0} already exist for this student and subject.").format(duplicate))

	def sync_components_with_pattern(self):
		"""The pattern owns the component list; this document only holds the marks scored."""
		pattern_rows = get_component_rows(self.subject_pattern) if self.subject_pattern else []
		if not pattern_rows:
			# no pattern on the exam row: the subject is marked as a single total
			pattern_rows = [frappe._dict({"component": WHOLE_SUBJECT, "weightage": 100})]

		# the desk grid seeds a blank row before a component is set
		self.components[:] = [row for row in self.components if row.component]

		by_component = {row.component: row for row in pattern_rows}
		unknown = {row.component for row in self.components} - set(by_component)
		if unknown:
			frappe.throw(
				_("These components are not part of {0}: {1}").format(
					self.subject_pattern or self.subject, ", ".join(sorted(unknown))
				)
			)

		seen = set()
		for row in self.components:
			if row.component in seen:
				frappe.throw(_("Component {0} is listed more than once.").format(row.component))
			seen.add(row.component)

		for pattern_row in pattern_rows:
			if pattern_row.component not in seen:
				self.append("components", {"component": pattern_row.component, "marks_obtained": 0})

		order = {row.component: index for index, row in enumerate(pattern_rows)}
		self.components.sort(key=lambda row: order[row.component])
		for index, row in enumerate(self.components, start=1):
			row.idx = index
			row.weightage = by_component[row.component].weightage
			row.max_marks = flt(flt(self.max_marks) * flt(row.weightage) / 100, 2)

	def calculate(self):
		for row in self.components:
			marks = flt(row.marks_obtained)
			if marks < 0 or marks > flt(row.max_marks):
				frappe.throw(
					_("{0}: marks must be between 0 and {1}.").format(row.component, flt(row.max_marks))
				)

		self.total_marks_obtained = sum(flt(row.marks_obtained) for row in self.components)
		self.percentage = (
			flt(self.total_marks_obtained * 100 / flt(self.max_marks), 2) if flt(self.max_marks) else 0
		)
		scale = frappe.get_cached_doc("CS17 Grading Scale", self.grading_scale)
		self.grade = scale.get_grade(self.percentage)
		self.is_pass = scale.is_pass(self.percentage)

	def on_update(self):
		self.refresh_result()

	def on_trash(self):
		self.refresh_result()

	def refresh_result(self):
		"""The result is a rollup of these documents, so keep it in step."""
		result = frappe.db.exists("CS17 Result", {"exam": self.exam, "student": self.student})
		if result:
			frappe.get_doc("CS17 Result", result).save(ignore_permissions=True)

	@frappe.whitelist()
	def load_pattern_components(self):
		self.set_exam_subject_context()
		self.sync_components_with_pattern()


def get_subject_totals(exam: str, student: str) -> dict[str, float]:
	rows = frappe.get_all(
		"CS17 Subject Marks",
		filters={"exam": exam, "student": student},
		fields=["subject", "total_marks_obtained"],
	)
	return {row.subject: flt(row.total_marks_obtained) for row in rows}
