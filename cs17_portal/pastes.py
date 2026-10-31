import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import now_datetime

from cs17_portal.api import ASSIGNMENT_SUBMISSION, require_faculty_for_assignment, require_owned_project


@frappe.whitelist(methods=["POST"])
@rate_limit(key="project", limit=120, seconds=60, methods=["POST"], ip_based=False)
def record_paste(project: str, text: str) -> None:
	project_doc = require_owned_project(project)
	project_doc._require_watched_assignment()
	frappe.get_doc(
		{
			"doctype": "CS17 Paste",
			"assignment": project_doc.assignment,
			"student": project_doc.profile,
			"pasted_at": now_datetime(),
			"line_count": len(text.splitlines()),
			"character_count": len(text),
			"text": text,
		}
	).insert(ignore_permissions=True)


@frappe.whitelist(methods=["GET"])
def get_pastes(submission: str) -> list:
	submission_doc = frappe.db.get_value(
		ASSIGNMENT_SUBMISSION, submission, ["assignment", "student"], as_dict=True
	)
	if not submission_doc:
		frappe.throw(_("Submission not found"), frappe.DoesNotExistError)
	require_faculty_for_assignment(submission_doc.assignment)
	return frappe.get_all(
		"CS17 Paste",
		filters={"assignment": submission_doc.assignment, "student": submission_doc.student},
		fields=["pasted_at", "line_count", "text"],
		order_by="pasted_at asc",
	)
