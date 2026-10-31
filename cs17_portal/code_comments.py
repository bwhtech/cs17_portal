import frappe
from frappe import _
from frappe.model.document import Document

from cs17_portal.api import (
	ASSIGNMENT_SUBMISSION,
	get_current_faculty,
	is_published_now,
	require_current_student,
	require_faculty_for_assignment,
)

CODE_COMMENT = "CS17 Code Comment"


@frappe.whitelist(methods=["GET"])
def get_code_comments(submission: str) -> list:
	submission_doc = get_submission_for_faculty(submission)
	return frappe.get_all(
		CODE_COMMENT,
		filters={"submission": submission, "submitted_at": submission_doc.submitted_at},
		fields=["name", "line", "comment", "owner"],
		order_by="line asc, creation asc",
	)


@frappe.whitelist(methods=["POST"])
def add_code_comment(submission: str, line: int, comment: str) -> None:
	submission_doc = get_submission_for_faculty(submission)
	if not 1 <= line <= len((submission_doc.code or "").splitlines()):
		frappe.throw(_("Line {0} is not in this code.").format(line))
	frappe.get_doc(
		{
			"doctype": CODE_COMMENT,
			"submission": submission,
			"submitted_at": submission_doc.submitted_at,
			"line": line,
			"comment": comment,
		}
	).insert(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def update_code_comment(code_comment: str, comment: str) -> None:
	doc = get_own_code_comment(code_comment)
	doc.comment = comment
	doc.save(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def delete_code_comment(code_comment: str) -> None:
	get_own_code_comment(code_comment).delete(ignore_permissions=True)


@frappe.whitelist(methods=["GET"])
def get_student_code_comments(submission: str) -> list:
	student = require_current_student()
	submission_doc = frappe.db.get_value(
		ASSIGNMENT_SUBMISSION,
		{"name": submission, "student": student},
		["code", "submitted_at"],
		as_dict=True,
	)
	if not submission_doc:
		frappe.throw(_("Submission not found"), frappe.DoesNotExistError)
	grade = frappe.db.get_value(
		"CS17 Assignment Grade",
		{"submission": submission},
		["is_published", "published_on"],
		as_dict=True,
	)
	if not (grade and is_published_now(grade, "published_on")):
		return []
	lines = (submission_doc.code or "").splitlines()
	comments = frappe.get_all(
		CODE_COMMENT,
		filters={"submission": submission, "submitted_at": submission_doc.submitted_at},
		fields=["name", "line", "comment"],
		order_by="line asc, creation asc",
	)
	for comment in comments:
		comment.code = lines[comment.line - 1].strip()
	return comments


def get_submission_for_faculty(submission: str) -> frappe._dict:
	submission_doc = frappe.db.get_value(
		ASSIGNMENT_SUBMISSION, submission, ["assignment", "code", "submitted_at"], as_dict=True
	)
	if not submission_doc:
		frappe.throw(_("Submission not found"), frappe.DoesNotExistError)
	require_faculty_for_assignment(submission_doc.assignment)
	return submission_doc


def get_own_code_comment(code_comment: str) -> Document:
	get_current_faculty()
	doc = frappe.get_doc(CODE_COMMENT, code_comment)
	if doc.owner != frappe.session.user:
		frappe.throw(_("You can only change your own comments."), frappe.PermissionError)
	return doc
