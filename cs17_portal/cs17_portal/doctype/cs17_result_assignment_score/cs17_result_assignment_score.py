# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import flt


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
		is_graded: DF.Check
		is_submitted: DF.Check
		marks_obtained: DF.Float
		max_marks: DF.Float
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		remarks: DF.SmallText | None
	# end: auto-generated types

	pass


def get_assignment_score(assignment: dict, grade: dict) -> dict:
	graded = assignment.assignment_type == "Graded"
	# a letter assignment still carries marks it never used; the letter is set on both kinds
	by_marks = graded and assignment.evaluation_type == "Marks"
	return {
		"assignment": assignment.name,
		"assignment_title": assignment.title,
		"assignment_type": assignment.assignment_type,
		"evaluation_type": assignment.evaluation_type,
		"due_date": assignment.due_date,
		"max_marks": flt(assignment.max_marks) if by_marks else 0,
		"marks_obtained": flt(grade.get("marks_obtained")) if by_marks else 0,
		"grade": grade.get("grade") if graded else None,
		"is_submitted": 1 if grade.get("submission") else 0,
		"is_graded": 1 if grade.get("grade_name") else 0,
		"remarks": grade.get("remarks"),
	}
