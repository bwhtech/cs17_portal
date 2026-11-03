import json
from collections import Counter

import frappe
from frappe import _

from cs17_portal.api import get_current_faculty
from cs17_portal.cs17_portal.doctype.cs17_viva.cs17_viva import get_component_max_marks

VIVA = "CS17 Viva"
VIVA_MARK = "CS17 Viva Mark"


@frappe.whitelist(methods=["GET"])
def get_vivas() -> list[dict]:
	cohort = get_current_faculty().cohort
	vivas = frappe.get_all(
		VIVA,
		filters={"cohort": cohort} if cohort else {},
		fields=["name", "exam_name", "subject_name", "component", "cohort"],
		order_by="creation desc",
	)
	students = Counter(
		frappe.get_all(
			"CS17 Profile",
			filters={"profile_type": "Student", "cohort": ("in", list({viva.cohort for viva in vivas}))},
			pluck="cohort",
		)
	)
	marked = Counter(
		row.viva
		for row in frappe.get_all(
			VIVA_MARK,
			filters={"viva": ("in", [viva.name for viva in vivas])},
			fields=["viva", "student"],
			distinct=True,
		)
	)
	for viva in vivas:
		viva.students = students[viva.cohort]
		viva.marked = marked[viva.name]
	return vivas


@frappe.whitelist(methods=["GET"])
def get_viva(viva: str) -> dict:
	doc = get_faculty_viva(viva)
	marks = frappe.get_all(
		VIVA_MARK, filters={"viva": viva}, fields=["student", "question", "marks_obtained"]
	)
	asked = Counter(row.question for row in marks)
	marks_by_student = {}
	for row in marks:
		marks_by_student.setdefault(row.student, {})[row.question] = row.marks_obtained

	students = frappe.get_all(
		"CS17 Profile",
		filters={"profile_type": "Student", "cohort": doc.cohort},
		fields=["name", "full_name"],
		order_by="full_name asc",
	)
	return {
		"name": doc.name,
		"exam_name": doc.exam_name,
		"subject_name": doc.subject_name,
		"component": doc.component,
		"max_marks": get_component_max_marks(doc.exam, doc.subject)[doc.component],
		"questions": [
			{
				"name": row.name,
				"section": row.section,
				"question": row.question,
				"code": row.code,
				"answer": row.answer,
				"marks": row.marks,
				"asked": asked[row.name],
			}
			for row in doc.questions
		],
		"students": [
			{
				"student": student.name,
				"student_name": student.full_name,
				"marks": marks_by_student.get(student.name, {}),
			}
			for student in students
		],
	}


@frappe.whitelist(methods=["POST"])
def save_viva_marks(viva: str, student: str, marks: dict | str) -> float:
	doc = get_faculty_viva(viva)
	if isinstance(marks, str):
		marks = json.loads(marks)
	return doc.record_marks(student, marks)


def get_faculty_viva(viva: str) -> "frappe.model.document.Document":
	faculty = get_current_faculty()
	doc = frappe.get_doc(VIVA, viva)
	if faculty.cohort and faculty.cohort != doc.cohort:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return doc
