from typing import TYPE_CHECKING

import frappe
from frappe import _

if TYPE_CHECKING:
	from frappe.model.document import Document


@frappe.whitelist(methods=["GET"])
def get_user_profile() -> dict | None:
	return frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user},
		["name", "full_name", "profile_type", "cohort", "profile_picture"],
		as_dict=True,
	)


@frappe.whitelist(methods=["GET"])
def get_recent_submissions(faculty: str, limit: int = 5) -> list:
	profile = frappe.get_doc("CS17 Profile", faculty)
	if profile.user != frappe.session.user:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	if not profile.cohort:
		return []
	return frappe.get_list(
		"CS17 Assignment Submission",
		filters=[["assignment.cohort", "=", profile.cohort]],
		fields=["name", "student", "full_name", "assignment", "assignment_title", "submitted_at"],
		order_by="submitted_at desc",
		limit=limit,
		ignore_permissions=True,
	)


@frappe.whitelist(methods=["GET"])
def get_faculty_assignments(cohort: str | None = None) -> list:
	validate_membership("Faculty")
	filters = {"cohort": cohort} if cohort else {}
	assignments = frappe.get_all(
		"CS17 Assignment",
		filters=filters,
		fields=[
			"name",
			"title",
			"cohort",
			"submission_type",
			"assignment_type",
			"due_date",
			"is_published",
			"publish_on",
		],
		order_by="creation desc",
	)
	_attach_submission_counts(assignments)
	return assignments


def _attach_submission_counts(assignments: list) -> None:
	names = [assignment["name"] for assignment in assignments]
	if not names:
		return
	rows = frappe.get_all(
		"CS17 Assignment Submission",
		filters=[["assignment", "in", names]],
		fields=["assignment", {"COUNT": "name", "as": "count"}],
		group_by="assignment",
	)
	counts = {row["assignment"]: row["count"] for row in rows}
	for assignment in assignments:
		assignment["submission_count"] = counts.get(assignment["name"], 0)


@frappe.whitelist(methods=["POST"])
def create_assignment(
	title: str,
	cohort: str,
	due_date: str,
	submission_type: str = "Any",
	description: str | None = None,
	assignment_type: str = "Not Graded",
	max_marks: float = 0,
	remarks: str = "Grade",
	publish: str = "draft",
	publish_on: str | None = None,
) -> str:
	validate_membership("Faculty")
	assignment = frappe.new_doc("CS17 Assignment")
	assignment.update(
		{
			"title": title,
			"cohort": cohort,
			"due_date": due_date,
			"submission_type": submission_type,
			"description": description,
			"assignment_type": assignment_type,
			"naming_series": _naming_series(assignment_type),
		}
	)
	if assignment_type == "Graded":
		assignment.max_marks = max_marks
		assignment.remarks = remarks
	_apply_publish_state(assignment, publish, publish_on)
	assignment.insert(ignore_permissions=True)
	return assignment.name


def _naming_series(assignment_type: str) -> str:
	if assignment_type == "Graded":
		return "GRADED-.{cohort}.-.###"
	return "NOT-GRADED-.{cohort}.-.###"


def _apply_publish_state(
	doc: "Document", publish: str, publish_on: str | None, publish_on_field: str = "publish_on"
) -> None:
	if publish == "now":
		doc.is_published = 1
	elif publish == "schedule":
		if not publish_on:
			frappe.throw(_("A publish date is required to schedule"))
		doc.is_published = 0
		doc.set(publish_on_field, publish_on)
	else:
		doc.is_published = 0


@frappe.whitelist(methods=["GET"])
def get_assignment_submissions(assignment: str) -> dict:
	validate_membership("Faculty")
	assignment_doc = frappe.db.get_value(
		"CS17 Assignment",
		assignment,
		[
			"name",
			"title",
			"description",
			"due_date",
			"cohort",
			"submission_type",
			"assignment_type",
			"max_marks",
			"remarks",
		],
		as_dict=True,
	)
	if not assignment_doc:
		frappe.throw(_("Assignment not found"))
	submissions = frappe.get_all(
		"CS17 Assignment Submission",
		filters={"assignment": assignment},
		fields=[
			"name",
			"student",
			"full_name",
			"submitted_at",
			"submission_document",
			"submission_url",
		],
		order_by="submitted_at desc",
	)
	_attach_grades(submissions)
	return {"assignment": assignment_doc, "submissions": submissions}


def _attach_grades(submissions: list) -> None:
	names = [submission["name"] for submission in submissions]
	if not names:
		return
	grades = frappe.get_all(
		"CS17 Assignment Grade",
		filters=[["submission", "in", names]],
		fields=["submission", "grade", "marks_obtained", "remarks", "is_published", "published_on"],
	)
	grade_by_submission = {grade["submission"]: grade for grade in grades}
	for submission in submissions:
		submission["grade"] = grade_by_submission.get(submission["name"])


@frappe.whitelist(methods=["POST"])
def grade_submission(
	submission: str,
	grade: str | None = None,
	marks_obtained: float | None = None,
	remarks: str | None = None,
	publish: str = "draft",
	publish_on: str | None = None,
) -> dict:
	validate_membership("Faculty")
	sub_doc = frappe.get_doc("CS17 Assignment Submission", submission)
	evaluation_type = frappe.db.get_value("CS17 Assignment", sub_doc.assignment, "remarks")
	if evaluation_type not in ("Grade", "Marks"):
		frappe.throw(_("This assignment is not gradable"))
	existing = frappe.db.get_value("CS17 Assignment Grade", {"submission": submission}, "name")
	doc = (
		frappe.get_doc("CS17 Assignment Grade", existing)
		if existing
		else frappe.new_doc("CS17 Assignment Grade")
	)
	doc.update(
		{
			"assignment": sub_doc.assignment,
			"submission": submission,
			"evaluation_type": evaluation_type,
			"graded_by": frappe.session.user,
			"grade": grade if evaluation_type == "Grade" else None,
			"marks_obtained": marks_obtained if evaluation_type == "Marks" else None,
			"remarks": remarks,
		}
	)
	_apply_publish_state(doc, publish, publish_on, "published_on")
	doc.save(ignore_permissions=True)
	return {"name": doc.name}


def get_current_profile_name(profile_type: str) -> str | None:
	return frappe.db.get_value(
		"CS17 Profile",
		{"user": frappe.session.user, "profile_type": profile_type},
		"name",
	)


def validate_membership(profile_type: str) -> None:
	if not get_current_profile_name(profile_type):
		frappe.throw(
			_("No {0} profile found for current user").format(profile_type),
			frappe.PermissionError,
		)
