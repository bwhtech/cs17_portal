from typing import TYPE_CHECKING

import frappe
from frappe import _
from frappe.query_builder.functions import Max
from frappe.rate_limiter import rate_limit
from frappe.sessions import hash_sid
from frappe.utils import cint, flt, now_datetime, time_diff_in_seconds

from cs17_portal.api import require_current_student
from cs17_portal.coding_exam import (
	CODING_EXAM,
	attempt_closed_reason,
	get_attempt_doc,
	get_student_exam,
	progress_row,
)
from cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission import (
	AUTO_SUBMIT_GRACE_SECONDS,
)

if TYPE_CHECKING:
	from datetime import datetime

	from frappe.model.document import Document

EXAM_EVENT = "CS17 Exam Event"
STUDENT_EVENT_KINDS = (
	"tab_leave",
	"window_blur",
	"fullscreen_exit",
	"paste_blocked",
	"paste",
	"copy_question",
	"split_screen",
	"second_screen",
)
LEAVE_KINDS = ("tab_leave", "window_blur")
CODE_JUMP_LINES = 15
CODE_JUMP_SECONDS = 30


@frappe.whitelist(methods=["POST"])
@rate_limit(key="kind", limit=30, seconds=60, methods=["POST"], ip_based=False, user_based=True)
def record_exam_event(
	exam: str,
	kind: str,
	assignment: str | None = None,
	seconds: float | None = None,
	detail: str | None = None,
) -> None:
	student = require_current_student()
	exam_doc = get_student_exam(exam, student)
	attempt = get_attempt_doc(exam, student)
	if reason := attempt_closed_reason(attempt, AUTO_SUBMIT_GRACE_SECONDS):
		frappe.throw(reason)
	if kind not in STUDENT_EVENT_KINDS:
		frappe.throw(_("Unknown exam event."))
	if assignment and assignment not in [row.assignment for row in exam_doc.questions]:
		frappe.throw(_("Question not found"), frappe.DoesNotExistError)

	leave = (
		kind in LEAVE_KINDS
		and flt(seconds) > 0
		and frappe.db.get_value(
			EXAM_EVENT,
			{"exam": exam, "student": student, "kind": kind, "seconds": 0},
			order_by="occurred_at desc",
		)
	)
	if leave:
		frappe.db.set_value(EXAM_EVENT, leave, "seconds", flt(seconds, 1))
	else:
		record_event(exam, student, kind, assignment, flt(seconds, 1), (detail or "").strip()[:140])
	if kind in counted_leave_kinds(exam_doc):
		apply_leave_rule(exam_doc, attempt, assignment)


def record_event(
	exam: str,
	student: str,
	kind: str,
	assignment: str | None = None,
	seconds: float = 0,
	detail: str | None = None,
) -> None:
	frappe.get_doc(
		{
			"doctype": EXAM_EVENT,
			"exam": exam,
			"student": student,
			"assignment": assignment,
			"kind": kind,
			"occurred_at": now_datetime(),
			"seconds": seconds,
			"detail": detail or None,
		}
	).insert(ignore_permissions=True, ignore_links=True)


def counted_leave_kinds(exam_doc: "Document") -> tuple:
	return LEAVE_KINDS if exam_doc.count_window_switches else ("tab_leave",)


def apply_leave_rule(exam_doc: "Document", attempt: "Document", assignment: str | None) -> None:
	leave_limit, leave_seconds = cint(exam_doc.leave_limit), cint(exam_doc.leave_seconds)
	if not (leave_limit or leave_seconds):
		return
	away = frappe.get_all(
		EXAM_EVENT,
		filters={
			"exam": exam_doc.name,
			"student": attempt.student,
			"kind": ["in", counted_leave_kinds(exam_doc)],
		},
		pluck="seconds",
	)
	seconds_away = sum(flt(seconds) for seconds in away)
	if leave_limit and len(away) >= leave_limit:
		reason = _("{0} leaves").format(len(away))
	elif leave_seconds and seconds_away >= leave_seconds:
		reason = _("{0} s away").format(cint(seconds_away))
	else:
		return
	if frappe.db.exists(
		EXAM_EVENT, {"exam": exam_doc.name, "student": attempt.student, "kind": "rule_action"}
	):
		return

	if exam_doc.leave_action == "Submit exam":
		attempt.finish()
		detail = _("Submitted the exam after {0}").format(reason)
	elif exam_doc.leave_action == "Lock question" and assignment:
		step = progress_row(attempt, assignment)
		step.skipped_on = step.locked_on = now_datetime()
		attempt.save(ignore_permissions=True)
		detail = _("Locked {0} after {1}").format(
			frappe.db.get_value("CS17 Assignment", assignment, "title"), reason
		)
	else:
		detail = _("Flagged after {0}").format(reason)
	record_event(exam_doc.name, attempt.student, "rule_action", assignment, detail=detail)


def record_second_login(exam: str, student: str, since: "datetime") -> None:
	sessions = frappe.qb.DocType("Sessions")
	last_seen = (
		frappe.qb.from_(sessions)
		.select(Max(sessions.lastupdate))
		.where(sessions.user == frappe.session.user)
		.where(sessions.sid != hash_sid(frappe.session.sid))
		.where(sessions.lastupdate >= since)
	).run()[0][0]
	if last_seen and not frappe.db.exists(
		EXAM_EVENT,
		{"exam": exam, "student": student, "kind": "second_login", "occurred_at": [">=", last_seen]},
	):
		record_event(exam, student, "second_login")
		# the exam poll is a GET, which Frappe rolls back unless told to commit
		frappe.local.flags.commit = True


def record_code_jump(exam: str, project_doc: "Document", code: str) -> None:
	added = len(code.splitlines()) - len((project_doc.code or "").splitlines())
	if added < CODE_JUMP_LINES or not project_doc.last_saved_at:
		return
	seconds = time_diff_in_seconds(now_datetime(), project_doc.last_saved_at)
	if seconds > CODE_JUMP_SECONDS or frappe.db.get_value(CODING_EXAM, exam, "paste_rule") == "Allow":
		return
	if not frappe.db.exists(
		EXAM_EVENT,
		{
			"exam": exam,
			"student": project_doc.profile,
			"assignment": project_doc.assignment,
			"kind": "paste",
			"occurred_at": [">=", project_doc.last_saved_at],
		},
	):
		record_event(
			exam,
			project_doc.profile,
			"code_jump",
			project_doc.assignment,
			flt(seconds, 1),
			_("{0} lines").format(added),
		)
