# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from urllib.parse import urlparse

import frappe
from frappe import _
from frappe.model.document import Document

from cs17_portal.api import get_current_profile_name


class CS17AssignmentSubmission(Document):
	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amended_from: DF.Link | None
		assignment: DF.Link
		assignment_title: DF.Data | None
		full_name: DF.Data | None
		naming_series: DF.Literal["SUB.-.{assignment}.-.###"]
		student: DF.Link
		submission_document: DF.Attach
		submitted_at: DF.Datetime | None
	# end: auto-generated types

	def validate(self):
		student_user = frappe.db.get_value("CS17 Profile", self.student, "user")
		if frappe.session.user != student_user:
			return
		due_date = frappe.db.get_value("CS17 Assignment", self.assignment, "due_date")
		if due_date and frappe.utils.now_datetime() > due_date:
			frappe.throw(_("The deadline for this assignment has passed."))


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
	student = get_current_profile_name("Student")
	if not student:
		frappe.throw(_("No Student profile found for current user"), frappe.PermissionError)
	doc = frappe.get_doc(
		{
			"doctype": "CS17 Assignment Submission",
			"naming_series": "SUB.-.{assignment}.-.###",
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
	student = get_current_profile_name("Student")
	sub_doc = frappe.get_doc("CS17 Assignment Submission", submission)
	if not student or sub_doc.student != student:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	sub_doc.update(resolve_submission(sub_doc.assignment, file_url))
	sub_doc.submitted_at = frappe.utils.now_datetime()
	sub_doc.save(ignore_permissions=True)
	return {"name": sub_doc.name}
