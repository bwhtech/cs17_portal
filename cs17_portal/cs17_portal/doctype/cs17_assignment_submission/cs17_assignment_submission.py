# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from urllib.parse import urlparse

import frappe
from frappe import _
from frappe.model.document import Document

from cs17_portal.api import require_current_student
from cs17_portal.cs17_portal.doctype.cs17_project.cs17_project import get_owner_profile


class CS17AssignmentSubmission(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amended_from: DF.Link | None
		assignment: DF.Link
		assignment_title: DF.Data | None
		full_name: DF.Data | None
		naming_series: DF.Literal["SUB.-.{assignment}.-.###"]
		project: DF.Link | None
		student: DF.Link
		submission_document: DF.Attach | None
		submission_url: DF.Data | None
		submitted_at: DF.Datetime | None
	# end: auto-generated types

	def validate(self):
		student_user = frappe.db.get_value("CS17 Profile", self.student, "user")
		if frappe.session.user != student_user:
			return
		due_date = frappe.db.get_value("CS17 Assignment", self.assignment, "due_date")
		if due_date and frappe.utils.now_datetime() > due_date:
			frappe.throw(_("The deadline for this assignment has passed."))


def get_permission_query_conditions(user: str | None = None) -> str:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return ""

	profile = get_owner_profile(user)
	if not profile:
		return "1 = 0"

	if profile.profile_type == "Student":
		return f"`tabCS17 Assignment Submission`.student = {frappe.db.escape(profile.name)}"

	# Faculty may read every submission for an assignment in their cohort.
	if profile.cohort:
		return (
			"`tabCS17 Assignment Submission`.assignment in "
			f"(select name from `tabCS17 Assignment` where cohort = {frappe.db.escape(profile.cohort)})"
		)
	return "1 = 0"


# `ptype` is the parameter name Frappe's has_permission hook passes (framework contract), so it must
# match exactly for the permission type to bind.
def has_permission(doc: Document, ptype: str | None = None, user: str | None = None) -> bool:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return True

	profile = get_owner_profile(user)
	if not profile:
		return False

	if profile.profile_type == "Student":
		return doc.student == profile.name

	# Faculty get read-only access, scoped to submissions for assignments in their own cohort.
	if ptype not in (None, "read", "select", "report", "export", "print", "email", "share"):
		return False
	assignment_cohort = frappe.db.get_value("CS17 Assignment", doc.assignment, "cohort")
	return bool(profile.cohort) and assignment_cohort == profile.cohort


SUBMISSION_EXTENSIONS = {
	"PDF": (".pdf",),
	"Image": (".png", ".jpg", ".jpeg", ".gif", ".webp"),
	"ZIP": (".zip", ".tar.gz", ".tgz"),
}


def validate_submission_value(submission_type: str | None, file_url: str) -> None:
	if not submission_type or submission_type == "Any":
		return
	if submission_type == "URL":
		if not is_valid_url(file_url):
			frappe.throw(_("This assignment requires a valid URL (http:// or https://)."))
		return
	if not file_url.lower().endswith(SUBMISSION_EXTENSIONS[submission_type]):
		frappe.throw(_("This assignment only accepts {0} files.").format(submission_type))


def is_valid_url(value: str) -> bool:
	parsed = urlparse(value.strip())
	return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def resolve_submission(assignment: str, file_url: str) -> dict:
	# URLs go to submission_url, uploaded files to submission_document.
	submission_type = frappe.db.get_value("CS17 Assignment", assignment, "submission_type")
	validate_submission_value(submission_type, file_url)
	if submission_type == "URL":
		return {"submission_url": file_url, "submission_document": None}
	return {"submission_document": file_url, "submission_url": None}


@frappe.whitelist()
def submit_assignment(assignment: str, file_url: str) -> dict:
	student = require_current_student()
	doc = frappe.get_doc(
		{
			"doctype": "CS17 Assignment Submission",
			"student": student,
			"assignment": assignment,
			"submitted_at": frappe.utils.now_datetime(),
			**resolve_submission(assignment, file_url),
		}
	)
	doc.insert(ignore_permissions=True)
	return {"name": doc.name}


@frappe.whitelist()
def edit_submission(submission: str, file_url: str) -> dict:
	student = require_current_student()
	sub_doc = frappe.get_doc("CS17 Assignment Submission", submission)
	if sub_doc.student != student:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	sub_doc.update(resolve_submission(sub_doc.assignment, file_url))
	sub_doc.submitted_at = frappe.utils.now_datetime()
	sub_doc.save(ignore_permissions=True)
	return {"name": sub_doc.name}
