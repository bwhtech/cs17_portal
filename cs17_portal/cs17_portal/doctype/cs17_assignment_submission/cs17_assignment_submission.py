# Copyright (c) 2026, developers@bwh.tech and contributors
# For license information, please see license.txt

from urllib.parse import urlparse

import frappe
from frappe import _
from frappe.model.document import Document

from cs17_portal.api import get_attempt, given_to, is_published_now, require_current_student
from cs17_portal.cs17_portal.doctype.cs17_project.cs17_project import get_owner_profile

AUTO_SUBMIT_GRACE_SECONDS = 30


class CS17AssignmentSubmission(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amended_from: DF.Link | None
		assignment: DF.Link
		assignment_title: DF.Data | None
		code: DF.Code | None
		full_name: DF.Data | None
		naming_series: DF.Literal["SUB.-.{assignment}.-.###"]
		project: DF.Link | None
		student: DF.Link
		submission_document: DF.Attach | None
		submission_url: DF.Data | None
		submitted_at: DF.Datetime | None
	# end: auto-generated types

	def validate(self):
		self.validate_duplicate()
		self.validate_open_to_student()
		self.validate_deadline()
		self.validate_time_limit()
		self.validate_not_graded()
		self.validate_project_acceptance()

	def validate_duplicate(self):
		duplicate = frappe.db.exists(
			"CS17 Assignment Submission",
			{
				"assignment": self.assignment,
				"student": self.student,
				"name": ("!=", self.name),
				"docstatus": ("!=", 2),
			},
		)
		if duplicate:
			frappe.throw(
				_("Submission {0} already exists for this student and assignment.").format(duplicate)
			)

	def validate_open_to_student(self):
		student = frappe.db.get_value("CS17 Profile", self.student, ["user", "cohort"], as_dict=True)
		if not student or frappe.session.user != student.user:
			return
		assignments = frappe.get_all(
			"CS17 Assignment",
			filters={"name": self.assignment, "cohort": student.cohort},
			or_filters=given_to(self.student),
			fields=["is_published", "publish_on"],
		)
		if not (assignments and is_published_now(assignments[0])):
			frappe.throw(_("This assignment is not open for submission."))

	def validate_deadline(self):
		if not self._edited_by_owner() or get_attempt(self.assignment, self.student):
			return
		due_date = frappe.db.get_value("CS17 Assignment", self.assignment, "due_date")
		if due_date and frappe.utils.now_datetime() > due_date:
			frappe.throw(_("The deadline for this assignment has passed."))

	def validate_time_limit(self):
		if not self._edited_by_owner():
			return
		attempt = get_attempt(self.assignment, self.student)
		if attempt and frappe.utils.now_datetime() > frappe.utils.add_to_date(
			attempt.ends_at, seconds=AUTO_SUBMIT_GRACE_SECONDS
		):
			frappe.throw(_("Your time for this assignment is up."))

	def validate_not_graded(self):
		if self.is_new() or not self._edited_by_owner():
			return
		grades = frappe.get_all(
			"CS17 Assignment Grade",
			filters={"submission": self.name},
			fields=["is_published", "published_on"],
		)
		if any(is_published_now(grade, "published_on") for grade in grades):
			frappe.throw(_("Closed assignments cannot be resubmitted."))

	def _edited_by_owner(self) -> bool:
		student_user = frappe.db.get_value("CS17 Profile", self.student, "user")
		return frappe.session.user == student_user

	def validate_project_acceptance(self):
		if not self.project:
			return
		assignment = frappe.db.get_value(
			"CS17 Assignment",
			self.assignment,
			["submission_type", "is_published", "publish_on"],
			as_dict=True,
		)
		project_type = frappe.db.get_value("CS17 Project", self.project, "project_type")
		if not assignment or assignment.submission_type != project_type:
			frappe.throw(_("This assignment does not accept {0} projects.").format(project_type))
		if not is_published_now(assignment):
			frappe.throw(_("This assignment is not open for submission."))


def get_permission_query_conditions(user: str | None = None) -> str:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return ""

	profile = get_owner_profile(user)
	if profile and profile.profile_type == "Student":
		return f"`tabCS17 Assignment Submission`.student = {frappe.db.escape(profile.name)}"
	return "1 = 0"


def has_permission(doc: Document, ptype: str | None = None, user: str | None = None) -> bool:
	user = user or frappe.session.user
	if "System Manager" in frappe.get_roles(user):
		return True

	profile = get_owner_profile(user)
	return bool(profile and profile.profile_type == "Student" and doc.student == profile.name)


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
	if submission_type in ("Scratch", "Python"):
		frappe.throw(_("{0} assignments are submitted from the project editor.").format(submission_type))
	if not file_url.lower().endswith(SUBMISSION_EXTENSIONS[submission_type]):
		frappe.throw(_("This assignment only accepts {0} files.").format(submission_type))


def is_valid_url(value: str) -> bool:
	parsed = urlparse(value.strip())
	return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def resolve_submission(assignment: str, file_url: str, submission: str | None = None) -> dict:
	submission_type = frappe.db.get_value("CS17 Assignment", assignment, "submission_type")
	validate_submission_value(submission_type, file_url)
	if submission_type == "URL":
		return {"submission_url": file_url, "submission_document": None}
	uploaded = frappe.get_all(
		"File",
		filters={"file_url": file_url, "owner": frappe.session.user, "attached_to_name": ("is", "not set")},
		pluck="file_url",
	)
	if file_url not in uploaded and not (
		submission
		and file_url
		in frappe.get_all(
			"File", filters={"file_url": file_url, "attached_to_name": submission}, pluck="file_url"
		)
	):
		frappe.throw(_("Upload your file before submitting it."))
	return {"submission_document": file_url, "submission_url": None}


@frappe.whitelist(methods=["POST"])
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


@frappe.whitelist(methods=["POST"])
def edit_submission(submission: str, file_url: str) -> dict:
	student = require_current_student()
	sub_doc = frappe.get_doc("CS17 Assignment Submission", submission)
	if sub_doc.student != student:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	sub_doc.update(resolve_submission(sub_doc.assignment, file_url, submission))
	sub_doc.submitted_at = frappe.utils.now_datetime()
	sub_doc.save(ignore_permissions=True)
	leftover = frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": "CS17 Assignment Submission",
			"attached_to_name": submission,
			"attached_to_field": "submission_document",
			"file_url": ("!=", sub_doc.submission_document or ""),
		},
		pluck="name",
	)
	if sub_doc.submission_document and frappe.db.exists(
		"File", {"file_url": sub_doc.submission_document, "attached_to_name": submission}
	):
		leftover += frappe.get_all(
			"File",
			filters={
				"file_url": sub_doc.submission_document,
				"owner": frappe.session.user,
				"attached_to_name": ("is", "not set"),
			},
			pluck="name",
		)
	for file_name in leftover:
		frappe.delete_doc("File", file_name, ignore_permissions=True)
	return {"name": sub_doc.name}
