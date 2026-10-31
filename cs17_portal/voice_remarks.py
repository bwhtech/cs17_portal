import base64

import frappe
from frappe import _

from cs17_portal.api import (
	ASSIGNMENT_SUBMISSION,
	VOICE_NOTE_EXTENSIONS,
	is_published_now,
	require_current_student,
)

MIME_TYPES = {extension: mime_type for mime_type, extension in VOICE_NOTE_EXTENSIONS.items()}


@frappe.whitelist(methods=["GET"])
def get_voice_remark(submission: str) -> str:
	student = require_current_student()
	grade = frappe.db.get_value(
		"CS17 Assignment Grade",
		{"submission": submission},
		["name", "voice_remark", "is_published", "published_on"],
		as_dict=True,
	)
	if not (
		grade
		and grade.voice_remark
		and is_published_now(grade, "published_on")
		and frappe.db.get_value(ASSIGNMENT_SUBMISSION, submission, "student") == student
	):
		frappe.throw(_("Voice note not found"), frappe.DoesNotExistError)

	voice_remark = frappe.get_doc(
		"File",
		{
			"file_url": grade.voice_remark,
			"attached_to_doctype": "CS17 Assignment Grade",
			"attached_to_name": grade.name,
		},
	)
	content = base64.b64encode(voice_remark.get_content(encodings=())).decode()
	return f"data:{MIME_TYPES[voice_remark.file_name.rpartition('.')[2]]};base64,{content}"
