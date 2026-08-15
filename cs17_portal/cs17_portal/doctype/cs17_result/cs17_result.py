# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from cs17_portal.cs17_portal.doctype.cs17_exam.cs17_exam import get_subject_rows
from cs17_portal.cs17_portal.doctype.cs17_project.cs17_project import get_owner_profile
from cs17_portal.cs17_portal.doctype.cs17_subject_marks.cs17_subject_marks import get_subject_totals


class CS17Result(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from cs17_portal.cs17_portal.doctype.cs17_result_subject_score.cs17_result_subject_score import (
			CS17ResultSubjectScore,
		)

		cohort: DF.Link | None
		exam: DF.Link
		grading_scale: DF.Link | None
		is_published: DF.Check
		naming_series: DF.Literal["RES-.{exam}.-.###"]
		overall_grade: DF.Data | None
		percentage: DF.Float
		published_on: DF.Datetime | None
		remarks: DF.SmallText | None
		result_status: DF.Literal["", "Pass", "Fail"]
		scores: DF.Table[CS17ResultSubjectScore]
		student: DF.Link
		student_name: DF.Data | None
		total_marks_obtained: DF.Float
		total_max_marks: DF.Float
	# end: auto-generated types

	def validate(self):
		self.set_exam_context()
		self.validate_student()
		self.validate_duplicate()
		self.sync_scores_with_exam()
		self.calculate()
		self.validate_publishable()

	def set_exam_context(self):
		self.grading_scale = frappe.db.get_value("CS17 Exam", self.exam, "grading_scale")
		if not self.grading_scale:
			frappe.throw(_("Exam {0} has no grading scale.").format(self.exam))

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
			"CS17 Result",
			{"exam": self.exam, "student": self.student, "name": ("!=", self.name)},
		)
		if duplicate:
			frappe.throw(_("Result {0} already exists for this student and exam.").format(duplicate))

	def sync_scores_with_exam(self):
		"""The exam owns the subject list and the max marks; the result only holds the marks scored."""
		exam_subjects = get_subject_rows(self.exam)
		if not exam_subjects:
			frappe.throw(_("Exam {0} has no subjects.").format(self.exam))

		# the desk grid seeds a blank row before a subject is picked
		self.scores[:] = [row for row in self.scores if row.subject]

		by_subject = {row.subject: row for row in exam_subjects}
		unknown = {row.subject for row in self.scores} - set(by_subject)
		if unknown:
			frappe.throw(
				_("These subjects are not part of {0}: {1}").format(self.exam, ", ".join(sorted(unknown)))
			)

		seen = set()
		for row in self.scores:
			if row.subject in seen:
				frappe.throw(_("Subject {0} is listed more than once.").format(row.subject))
			seen.add(row.subject)

		scored = {row.subject for row in self.scores}
		for exam_row in exam_subjects:
			if exam_row.subject not in scored:
				self.append("scores", {"subject": exam_row.subject, "marks_obtained": 0})

		# marks are entered in CS17 Subject Marks; this document only rolls them up
		totals = get_subject_totals(self.exam, self.student)
		self.flags.missing_marks = sorted(row.subject for row in exam_subjects if row.subject not in totals)

		order = {row.subject: index for index, row in enumerate(exam_subjects)}
		self.scores.sort(key=lambda row: order[row.subject])
		for index, row in enumerate(self.scores, start=1):
			exam_row = by_subject[row.subject]
			row.idx = index
			row.subject_name = exam_row.subject_name
			row.max_marks = exam_row.max_marks
			row.grading_scale = exam_row.grading_scale or self.grading_scale
			row.marks_obtained = totals.get(row.subject, 0)

	def calculate(self):
		for row in self.scores:
			max_marks = flt(row.max_marks)
			marks = flt(row.marks_obtained)
			if marks < 0 or marks > max_marks:
				frappe.throw(
					_("{0}: marks must be between 0 and {1}.").format(
						row.subject_name or row.subject, max_marks
					)
				)
			scale = frappe.get_cached_doc("CS17 Grading Scale", row.grading_scale)
			row.percentage = flt(marks * 100 / max_marks, 2) if max_marks else 0
			row.grade = scale.get_grade(row.percentage)
			row.is_pass = scale.is_pass(row.percentage)

		self.total_max_marks = sum(flt(row.max_marks) for row in self.scores)
		self.total_marks_obtained = sum(flt(row.marks_obtained) for row in self.scores)
		self.percentage = (
			flt(self.total_marks_obtained * 100 / self.total_max_marks, 2) if self.total_max_marks else 0
		)
		self.overall_grade = frappe.get_cached_doc("CS17 Grading Scale", self.grading_scale).get_grade(
			self.percentage
		)
		self.result_status = "Pass" if all(row.is_pass for row in self.scores) else "Fail"

	def validate_publishable(self):
		"""A subject with no marks entered would silently publish as a zero."""
		if self.is_published and self.flags.missing_marks:
			frappe.throw(
				_("Marks have not been entered for: {0}").format(", ".join(self.flags.missing_marks))
			)

	@frappe.whitelist()
	def load_exam_subjects(self):
		self.set_exam_context()
		self.sync_scores_with_exam()


def get_permission_query_conditions(user: str | None = None) -> str:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return ""

	profile = get_owner_profile(user)
	if profile and profile.profile_type == "Student":
		return (
			f"`tabCS17 Result`.student = {frappe.db.escape(profile.name)}"
			" and `tabCS17 Result`.is_published = 1"
		)
	return "1 = 0"


def has_permission(doc: Document, ptype: str | None = None, user: str | None = None) -> bool:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return True

	profile = get_owner_profile(user)
	return bool(
		profile and profile.profile_type == "Student" and doc.student == profile.name and doc.is_published
	)
