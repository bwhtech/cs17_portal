from datetime import datetime

import frappe
from frappe import _
from frappe.utils import now_datetime
from frappe.utils.csvutils import build_csv_response

from cs17_portal.api import get_class_work, summarize_class_work


@frappe.whitelist(methods=["GET"])
def download_gradebook(cohort: str, quarter: str | None = None) -> None:
	work = get_class_work(cohort, quarter)
	summary = {row.student: row for row in summarize_class_work(work)}
	assignments = sorted(
		(assignment for assignment in work.assignments if assignment.assignment_type == "Graded"),
		key=lambda assignment: (assignment.due_date, assignment.title),
	)
	now = now_datetime()
	build_csv_response(
		[
			[_("Student"), *(assignment.title for assignment in assignments), _("Average"), _("Grade")],
			*(
				[
					student.full_name,
					*(_get_mark(work, assignment, student.student, now) for assignment in assignments),
					summary[student.student].average,
					summary[student.student].grade,
				]
				for student in work.students
			),
		],
		" ".join(part for part in (_("Marks"), cohort, quarter) if part),
	)


def _get_mark(
	work: frappe._dict, assignment: frappe._dict, student: str, now: datetime
) -> float | str | None:
	given_to = work.students_by_assignment.get(assignment.name)
	if given_to and student not in given_to:
		return None
	submission = work.submissions.get((assignment.name, student))
	if not submission:
		return _("Missing") if (assignment.late_until or assignment.due_date) < now else None
	grade = work.published_grades.get(submission.name)
	if not grade:
		return None
	return grade.marks_obtained if assignment.remarks == "Marks" else grade.grade
