from datetime import datetime
from typing import TYPE_CHECKING

import frappe
from frappe import _
from frappe.utils import add_to_date, now_datetime

from cs17_portal.api import (
	ASSIGNMENT_SUBMISSION,
	get_current_faculty,
	given_to,
	is_published_now,
	summarize_class_work,
	validate_membership,
)

if TYPE_CHECKING:
	from frappe.model.document import Document

LATEST_GRADES = 3


@frappe.whitelist(methods=["GET"])
def get_my_children() -> list:
	children = get_children([validate_membership("Guardian")])
	now = now_datetime()
	for child in children:
		assignments = get_child_assignments(child)
		child.update(
			due=[assignment for assignment in assignments if is_due_this_week(assignment, now)],
			missing=[assignment for assignment in assignments if is_missing(assignment, now)],
			graded=sorted(
				(assignment for assignment in assignments if assignment.grade),
				key=lambda assignment: assignment.grade.published_at,
				reverse=True,
			)[:LATEST_GRADES],
			**get_average(child, assignments),
		)
	return children


@frappe.whitelist(methods=["GET"])
def get_child_overview(student: str) -> dict:
	child = next(
		(child for child in get_children([validate_membership("Guardian")]) if child.student == student),
		None,
	)
	if not child:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	assignments = get_child_assignments(child)
	return {
		"student": child,
		"assignments": assignments,
		"results": frappe.get_all(
			"CS17 Result",
			filters={"student": student, "is_published": 1},
			fields=[
				"name",
				"exam",
				"exam.exam_name as exam_name",
				"quarter",
				"total_marks_obtained",
				"total_max_marks",
				"percentage",
				"overall_grade",
				"result_status",
			],
			order_by="published_on desc, modified desc",
		),
		**get_average(child, assignments),
	}


@frappe.whitelist(methods=["GET"])
def get_student_guardians(student: str) -> list:
	require_faculty_for_student(student)
	return frappe.get_all(
		"CS17 Profile",
		filters=[["profile_type", "=", "Guardian"], ["students.student", "=", student]],
		fields=["name", "full_name", "user.email as email"],
		order_by="full_name asc",
	)


@frappe.whitelist(methods=["POST"])
def add_guardian(student: str, full_name: str, email: str) -> None:
	require_faculty_for_student(student)
	email = email.strip().lower()
	if frappe.utils.validate_email_address(email) != email:
		frappe.throw(_("Not a valid email."))
	profile = frappe.db.get_value("CS17 Profile", {"user": email}, ["name", "profile_type"], as_dict=True)
	if profile and profile.profile_type != "Guardian":
		frappe.throw(
			_("{0} already has a {1} profile, so they cannot be a guardian.").format(
				email, profile.profile_type
			)
		)
	guardian = frappe.get_doc("CS17 Profile", profile.name) if profile else new_guardian(full_name, email)
	if guardian.get("students", {"student": student}):
		frappe.throw(_("{0} is already a guardian of this student.").format(guardian.full_name))
	guardian.append("students", {"student": student})
	guardian.save(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def remove_guardian(student: str, guardian: str) -> None:
	require_faculty_for_student(student)
	guardian_doc = frappe.get_doc("CS17 Profile", guardian)
	rows = guardian_doc.get("students", {"student": student})
	if guardian_doc.profile_type != "Guardian" or not rows:
		frappe.throw(_("{0} is not a guardian of this student.").format(guardian_doc.full_name))
	guardian_doc.remove(rows[0])
	guardian_doc.save(ignore_permissions=True)


def new_guardian(full_name: str, email: str) -> "Document":
	first_name, _separator, last_name = " ".join(full_name.split()).partition(" ")
	if not last_name:
		frappe.throw(_("Add the guardian's first and last name."))
	if frappe.db.exists("User", email):
		frappe.throw(_("{0} already has a user. Add their profile in desk.").format(email))
	frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first_name,
			"last_name": last_name,
			"send_welcome_email": 1,
			"enabled": 1,
		}
	).insert(ignore_permissions=True)
	return frappe.get_doc(
		{
			"doctype": "CS17 Profile",
			"profile_type": "Guardian",
			"first_name": first_name,
			"last_name": last_name,
			"user": email,
		}
	)


def require_faculty_for_student(student: str) -> None:
	faculty = get_current_faculty()
	profile = frappe.db.get_value(
		"CS17 Profile", {"name": student, "profile_type": "Student"}, "cohort", as_dict=True
	)
	if not profile:
		frappe.throw(_("Student not found"), frappe.DoesNotExistError)
	if faculty.cohort and faculty.cohort != profile.cohort:
		frappe.throw(_("Not permitted"), frappe.PermissionError)


def get_children(guardians: list[str]) -> list:
	return frappe.get_all(
		"CS17 Guardian Student",
		filters={"parenttype": "CS17 Profile", "parentfield": "students", "parent": ("in", guardians)},
		fields=[
			"parent as guardian",
			"student",
			"student.full_name as full_name",
			"student.cohort as cohort",
			"student.profile_picture as profile_picture",
		],
		order_by="idx asc",
	)


def get_child_assignments(child: frappe._dict) -> list:
	assignments = [
		assignment
		for assignment in frappe.get_all(
			"CS17 Assignment",
			filters={"cohort": child.cohort},
			or_filters=given_to(child.student),
			fields=[
				"name",
				"title",
				"due_date",
				"late_until",
				"assignment_type",
				"remarks",
				"max_marks",
				"submission_type",
				"is_published",
				"publish_on",
			],
			order_by="due_date desc, creation desc",
		)
		if is_published_now(assignment)
	]
	submissions = {
		submission.assignment: submission
		for submission in frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={
				"student": child.student,
				"assignment": ("in", [assignment.name for assignment in assignments]),
				"docstatus": ("<", 2),
			},
			fields=["name", "student", "assignment", "submitted_at", "returned_on"],
		)
	}
	grades = {
		grade.submission: frappe._dict(
			evaluation_type=grade.evaluation_type,
			marks_obtained=grade.marks_obtained,
			grade=grade.grade,
			remarks=grade.remarks,
			published_at=grade.published_on or grade.modified,
		)
		for grade in frappe.get_all(
			"CS17 Assignment Grade",
			filters={"submission": ("in", [submission.name for submission in submissions.values()])},
			fields=[
				"submission",
				"evaluation_type",
				"marks_obtained",
				"grade",
				"remarks",
				"is_published",
				"published_on",
				"modified",
			],
		)
		if is_published_now(grade, "published_on")
	}
	for assignment in assignments:
		assignment.submission = submissions.get(assignment.name)
		assignment.grade = assignment.submission and grades.get(assignment.submission.name)
	return assignments


def get_average(child: frappe._dict, assignments: list) -> dict:
	summary = summarize_class_work(
		frappe._dict(
			students=[child],
			assignments=assignments,
			students_by_assignment={},
			submissions={
				(assignment.name, child.student): assignment.submission
				for assignment in assignments
				if assignment.submission
			},
			published_grades={
				assignment.submission.name: assignment.grade for assignment in assignments if assignment.grade
			},
		)
	)[0]
	return {"average": summary.average, "grade": summary.grade}


def is_due_this_week(assignment: frappe._dict, now: datetime) -> bool:
	return bool(
		(not assignment.submission or assignment.submission.returned_on)
		and assignment.due_date
		and now < assignment.due_date <= add_to_date(now, days=7)
	)


def is_missing(assignment: frappe._dict, now: datetime) -> bool:
	return bool(
		not assignment.submission
		and assignment.due_date
		and (assignment.late_until or assignment.due_date) < now
	)
