import base64

import frappe
from frappe import _
from frappe.utils import now_datetime

from cs17_portal.api import (
	ASSIGNMENT_SUBMISSION,
	insert_voice_note,
	require_current_student,
	require_faculty_for_assignment,
)
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import notify_students
from cs17_portal.voice_remarks import MIME_TYPES

EXPLANATION_REQUEST = "CS17 Explanation Request"


@frappe.whitelist(methods=["POST"])
def request_explanation(submission: str, question: str = "") -> None:
	submission_doc = frappe.db.get_value(
		ASSIGNMENT_SUBMISSION, submission, ["assignment", "assignment_title", "student"], as_dict=True
	)
	if not submission_doc:
		frappe.throw(_("Submission not found"), frappe.DoesNotExistError)
	require_faculty_for_assignment(submission_doc.assignment)
	frappe.get_doc(
		{
			"doctype": EXPLANATION_REQUEST,
			"submission": submission,
			"question": question.strip(),
			"requested_on": now_datetime(),
		}
	).insert(ignore_permissions=True)
	frappe.enqueue(
		notify_students,
		assignment=submission_doc.assignment,
		students=[submission_doc.student],
		subject=_("Explain your code: {0}").format(submission_doc.assignment_title),
		enqueue_after_commit=True,
	)


@frappe.whitelist(methods=["POST"])
def answer_explanation_request(request: str, voice_note: str) -> None:
	student = require_current_student()
	request_doc = frappe.get_doc(EXPLANATION_REQUEST, request)
	if frappe.db.get_value(ASSIGNMENT_SUBMISSION, request_doc.submission, "student") != student:
		frappe.throw(_("Explanation request not found"), frappe.DoesNotExistError)
	if request_doc.answered_on:
		frappe.throw(_("You already sent your explanation."))
	request_doc.voice_note = insert_voice_note(voice_note, "explanation").file_url
	request_doc.answered_on = now_datetime()
	request_doc.save(ignore_permissions=True)


@frappe.whitelist(methods=["GET"])
def get_explanation_request(submission: str) -> dict | None:
	assignment = frappe.db.get_value(ASSIGNMENT_SUBMISSION, submission, "assignment")
	if not assignment:
		frappe.throw(_("Submission not found"), frappe.DoesNotExistError)
	require_faculty_for_assignment(assignment)
	return latest_request(submission)


@frappe.whitelist(methods=["GET"])
def get_my_explanation_request(submission: str) -> dict | None:
	if frappe.db.get_value(ASSIGNMENT_SUBMISSION, submission, "student") != require_current_student():
		frappe.throw(_("Submission not found"), frappe.DoesNotExistError)
	return latest_request(submission)


def latest_request(submission: str) -> dict | None:
	request = frappe.db.get_value(
		EXPLANATION_REQUEST,
		{"submission": submission},
		["name", "question", "requested_on", "answered_on", "voice_note"],
		as_dict=True,
		order_by="requested_on desc",
	)
	if request and request.voice_note:
		voice_note = frappe.get_doc(
			"File",
			{
				"file_url": request.voice_note,
				"attached_to_doctype": EXPLANATION_REQUEST,
				"attached_to_name": request.name,
			},
		)
		content = base64.b64encode(voice_note.get_content(encodings=())).decode()
		request.voice_note = f"data:{MIME_TYPES[voice_note.file_name.rpartition('.')[2]]};base64,{content}"
	return request
