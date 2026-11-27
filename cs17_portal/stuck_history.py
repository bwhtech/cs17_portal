from collections import Counter
from itertools import groupby

import frappe
from frappe.utils import add_to_date, now_datetime

from cs17_portal.guardian import require_faculty_for_student
from cs17_portal.live_lab import STUCK_FAILING_MINUTES, STUCK_IDLE_MINUTES

STUCK_HISTORY_DAYS = 30


@frappe.whitelist(methods=["GET"])
def get_student_stuck_history(student: str) -> list:
	require_faculty_for_student(student)
	run = frappe.qb.DocType("CS17 Code Run")
	assignment = frappe.qb.DocType("CS17 Assignment")
	runs = (
		frappe.qb.from_(run)
		.join(assignment)
		.on(assignment.name == run.assignment)
		.select(
			run.assignment,
			assignment.title,
			assignment.topic,
			run.ran_at,
			run.passed,
			run.total,
			run.error_type,
			run.error_line,
		)
		.where(run.student == student)
		.where(run.ran_at >= add_to_date(now_datetime(), days=-STUCK_HISTORY_DAYS))
		.orderby(run.assignment)
		.orderby(run.ran_at)
		.run(as_dict=True)
	)

	spells = []
	for _assignment, assignment_runs in groupby(runs, key=lambda row: row.assignment):
		failed_runs = []
		not_past = []
		for row in [*assignment_runs, None]:
			failing = bool(row and (row.error_type or row.passed < row.total))
			same_sitting = bool(
				row
				and failed_runs
				and (row.ran_at - failed_runs[-1].ran_at).total_seconds() <= STUCK_IDLE_MINUTES * 60
			)
			if failing and (same_sitting or not failed_runs):
				failed_runs.append(row)
				continue
			if failed_runs:
				ended_at = row.ran_at if row and not failing and same_sitting else failed_runs[-1].ran_at
				minutes = int((ended_at - failed_runs[0].ran_at).total_seconds() // 60)
				if minutes >= STUCK_FAILING_MINUTES:
					errors = Counter(
						(run.error_type, run.error_line) for run in failed_runs if run.error_type
					)
					error_type, error_line = errors.most_common(1)[0][0] if errors else (None, None)
					spell = {
						"assignment": failed_runs[0].assignment,
						"title": failed_runs[0].title,
						"topic": failed_runs[0].topic,
						"started_at": failed_runs[0].ran_at,
						"minutes": minutes,
						"error_type": error_type,
						"error_line": error_line or None,
						"got_past": False,
					}
					spells.append(spell)
					not_past.append(spell)
			if row and not failing:
				for spell in not_past:
					spell["got_past"] = True
				not_past = []
			failed_runs = [row] if failing else []
	return sorted(spells, key=lambda spell: spell["started_at"], reverse=True)
