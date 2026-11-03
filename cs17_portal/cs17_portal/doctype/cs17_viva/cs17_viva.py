# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt

VIVA_MARK = "CS17 Viva Mark"


class CS17Viva(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_viva_question.cs17_viva_question import CS17VivaQuestion

		cohort: DF.Link | None
		component: DF.Data
		exam: DF.Link
		exam_name: DF.Data | None
		naming_series: DF.Literal["VIVA-.{cohort}.-.###"]
		questions: DF.Table[CS17VivaQuestion]
		subject: DF.Link
		subject_name: DF.Data | None
	# end: auto-generated types

	def validate(self):
		self.component = (self.component or "").strip()
		for row in self.questions:
			row.section = (row.section or "").strip()
		component_max_marks = get_component_max_marks(self.exam, self.subject)
		self.validate_component(component_max_marks)
		self.validate_section_marks(component_max_marks[self.component])
		self.validate_asked_questions()

	def validate_component(self, component_max_marks: dict[str, float]):
		if self.component not in component_max_marks:
			frappe.throw(
				_("{0} is not a part of {1} in this exam. Use one of: {2}").format(
					self.component, self.subject_name or self.subject, ", ".join(component_max_marks)
				)
			)

	def validate_section_marks(self, max_marks: float):
		section_marks = {}
		for row in self.questions:
			if cint(row.marks) < 1:
				frappe.throw(_("Row {0}: marks must be at least 1.").format(row.idx))
			if section_marks.setdefault(row.section, cint(row.marks)) != cint(row.marks):
				frappe.throw(
					_(
						"Every question in {0} must carry the same marks, so each viva is out of the same total."
					).format(row.section)
				)

		total = sum(section_marks.values())
		if total != flt(max_marks, 2):
			frappe.throw(
				_("One question from each section adds up to {0} marks, but {1} is out of {2}.").format(
					total, self.component, flt(max_marks, 2)
				)
			)

	def validate_asked_questions(self):
		if self.is_new():
			return
		asked = set(frappe.get_all(VIVA_MARK, filters={"viva": self.name}, pluck="question"))
		if not asked:
			return

		before = self.get_doc_before_save()
		if (before.exam, before.subject, before.component) != (self.exam, self.subject, self.component):
			frappe.throw(
				_("Students already have marks from this viva, so its exam, subject and part are locked.")
			)

		questions = {row.name: row for row in self.questions}
		for old in before.questions:
			if old.name not in asked:
				continue
			row = questions.get(old.name)
			if not row:
				frappe.throw(
					_("Row {0} has been asked in a viva, so it can no longer be removed.").format(old.idx)
				)
			if (row.section, cint(row.marks)) != (old.section, cint(old.marks)):
				frappe.throw(
					_("Row {0} has been asked in a viva, so its section and marks are locked.").format(
						row.idx
					)
				)

	def record_marks(self, student: str, marks: dict[str, float]) -> float:
		questions = {row.name: row for row in self.questions}
		unknown = set(marks) - set(questions)
		if unknown:
			frappe.throw(
				_("These questions are not part of this viva: {0}").format(", ".join(sorted(unknown)))
			)

		asked_sections = sorted(questions[question].section for question in marks)
		if asked_sections != sorted({row.section for row in self.questions}):
			frappe.throw(_("Give marks for one question from each section."))

		for question, value in marks.items():
			if not 0 <= flt(value) <= cint(questions[question].marks):
				frappe.throw(
					_("{0}: marks must be between 0 and {1}.").format(
						questions[question].section, cint(questions[question].marks)
					)
				)

		total = flt(sum(flt(value) for value in marks.values()), 9)
		self.update_subject_marks(student, total)

		frappe.db.delete(VIVA_MARK, {"viva": self.name, "student": student})
		for question, value in marks.items():
			frappe.get_doc(
				{
					"doctype": VIVA_MARK,
					"viva": self.name,
					"student": student,
					"question": question,
					"marks_obtained": flt(value),
				}
			).insert(ignore_permissions=True)
		return total

	def update_subject_marks(self, student: str, total: float) -> None:
		name = frappe.db.get_value(
			"CS17 Subject Marks", {"exam": self.exam, "student": student, "subject": self.subject}
		)
		subject_marks = (
			frappe.get_doc("CS17 Subject Marks", name)
			if name
			else frappe.get_doc(
				{
					"doctype": "CS17 Subject Marks",
					"exam": self.exam,
					"student": student,
					"subject": self.subject,
				}
			)
		)
		row = next((row for row in subject_marks.components if row.component == self.component), None)
		if not row:
			row = subject_marks.append("components", {"component": self.component})
		row.marks_obtained = total
		subject_marks.save(ignore_permissions=True)


def get_component_max_marks(exam: str, subject: str) -> dict[str, float]:
	subject_marks = frappe.new_doc("CS17 Subject Marks")
	subject_marks.exam = exam
	subject_marks.subject = subject
	subject_marks.load_pattern_components()
	return {row.component: row.max_marks for row in subject_marks.components}
