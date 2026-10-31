from collections import Counter

import frappe
from frappe.query_builder import Case
from frappe.query_builder.functions import Coalesce, Max
from frappe.rate_limiter import rate_limit
from frappe.utils import add_to_date, now_datetime

from cs17_portal.api import get_assignment_submissions, require_owned_project

STUCK_FAILING_MINUTES = 5
STUCK_IDLE_MINUTES = 10


@frappe.whitelist(methods=["POST"])
@rate_limit(key="project", limit=120, seconds=60, methods=["POST"], ip_based=False)
def record_code_run(
	project: str,
	passed: int = 0,
	total: int = 0,
	error_type: str | None = None,
	error_line: int | None = None,
) -> None:
	project_doc = require_owned_project(project)
	frappe.get_doc(
		{
			"doctype": "CS17 Code Run",
			"assignment": project_doc.assignment,
			"student": project_doc.profile,
			"ran_at": now_datetime(),
			"passed": passed,
			"total": total,
			"error_type": error_type,
			"error_line": error_line,
		}
	).insert(ignore_permissions=True)


@frappe.whitelist(methods=["GET"])
def get_live_lab(assignment: str) -> dict:
	detail = get_assignment_submissions(assignment)
	now = now_datetime()
	last_saved = dict(
		frappe.get_all(
			"CS17 Project",
			filters={"assignment": assignment},
			fields=["profile", {"MAX": "last_saved_at", "as": "last_saved_at"}],
			group_by="profile",
			as_list=True,
		)
	)
	run = frappe.qb.DocType("CS17 Code Run")
	failing = (Coalesce(run.error_type, "") != "") | (run.passed < run.total)
	failing_since = add_to_date(now, minutes=-STUCK_FAILING_MINUTES)
	summaries = {
		row.student: row
		for row in frappe.qb.from_(run)
		.select(
			run.student,
			Max(run.ran_at).as_("ran_at"),
			Max(Case().when(run.total > 0, run.ran_at)).as_("tested_at"),
			Max(Case().when(~failing, run.ran_at)).as_("passing_at"),
			Max(Case().when(failing & (run.ran_at <= failing_since), run.ran_at)).as_("failing_at"),
		)
		.where(run.assignment == assignment)
		.groupby(run.student)
		.run(as_dict=True)
	}
	ran_at = [at for row in summaries.values() for at in (row.ran_at, row.tested_at) if at]
	runs = {
		(row.student, row.ran_at): row
		for row in frappe.get_all(
			"CS17 Code Run",
			filters={"assignment": assignment, "ran_at": ["in", ran_at or [""]]},
			fields=["student", "ran_at", "passed", "total", "error_type", "error_line"],
		)
	}

	idle_since = add_to_date(now, minutes=-STUCK_IDLE_MINUTES)
	students = []
	for row in [*detail["submissions"], *detail["not_submitted"]]:
		summary = summaries.get(row.student, frappe._dict())
		latest = runs.get((row.student, summary.ran_at), frappe._dict())
		tested = runs.get((row.student, summary.tested_at), frappe._dict())
		last_active_at = max((at for at in (summary.ran_at, last_saved.get(row.student)) if at), default=None)
		submitted = bool(row.get("submitted_at") and not row.get("returned_on"))
		failing_for_a_while = bool(
			summary.failing_at and (not summary.passing_at or summary.failing_at > summary.passing_at)
		)
		students.append(
			{
				"student": row.student,
				"full_name": row.full_name,
				"submitted": submitted,
				"last_active_at": last_active_at,
				"passed": tested.passed,
				"total": tested.total,
				"error_type": latest.error_type,
				"error_line": latest.error_line or None,
				"stuck": not submitted
				and (failing_for_a_while or bool(last_active_at and last_active_at <= idle_since)),
			}
		)

	common_errors = Counter(
		(row["error_type"], row["error_line"])
		for row in students
		if row["error_type"] and not row["submitted"]
	)
	return {
		"title": detail["assignment"].title,
		"now": now,
		"students": sorted(
			students, key=lambda row: (not row["stuck"], row["submitted"], row["full_name"] or "")
		),
		"common_errors": [
			{"error_type": error_type, "error_line": error_line, "students": count}
			for (error_type, error_line), count in common_errors.most_common()
			if count > 1
		],
	}
