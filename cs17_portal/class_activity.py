import frappe
from frappe import _
from frappe.query_builder.functions import Max, Min
from frappe.rate_limiter import rate_limit
from frappe.utils import add_to_date, get_datetime, getdate, now_datetime, today

from cs17_portal.api import ASSIGNMENT_SUBMISSION, get_cohort_students, given_to
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import alert_students
from cs17_portal.guardian import require_faculty_for_student

IDLE_MINUTES = 60


@frappe.whitelist(methods=["GET"])
def get_class_activity(cohort: str, date: str | None = None) -> dict:
	return summarize_class_activity(get_cohort_students(cohort), date)


def summarize_class_activity(students: list, date: str | None = None) -> dict:
	date = str(getdate(date or today()))
	names = [student.student for student in students] or [""]
	on_the_day = ["between", [date, date]]
	work = {}

	def note(student: str, assignment: str, at) -> frappe._dict:
		row = work.setdefault(
			(student, assignment),
			frappe._dict(
				assignment=assignment,
				typed=False,
				runs=0,
				passed=None,
				total=None,
				submitted=False,
				first_active_at=at,
				last_active_at=at,
			),
		)
		row.first_active_at = min(row.first_active_at, at)
		row.last_active_at = max(row.last_active_at, at)
		return row

	for row in frappe.get_all(
		"CS17 Project",
		filters={"profile": ["in", names], "assignment": ["is", "set"], "creation": on_the_day},
		fields=["profile", "assignment", "creation"],
	):
		note(row.profile, row.assignment, row.creation)

	snapshot = frappe.qb.DocType("CS17 Code Snapshot")
	for row in (
		frappe.qb.from_(snapshot)
		.select(
			snapshot.student,
			snapshot.assignment,
			Min(snapshot.saved_at).as_("first_saved_at"),
			Max(snapshot.saved_at).as_("last_saved_at"),
		)
		.where(
			snapshot.student.isin(names)
			& snapshot.assignment.isnotnull()
			& snapshot.saved_at[f"{date} 00:00:00" : f"{date} 23:59:59.999999"]
		)
		.groupby(snapshot.student, snapshot.assignment)
		.run(as_dict=True)
	):
		note(row.student, row.assignment, row.first_saved_at)
		note(row.student, row.assignment, row.last_saved_at).typed = True

	for row in frappe.get_all(
		"CS17 Code Run",
		filters={"student": ["in", names], "assignment": ["is", "set"], "ran_at": on_the_day},
		fields=["student", "assignment", "ran_at", "passed", "total"],
		order_by="ran_at asc",
	):
		assignment = note(row.student, row.assignment, row.ran_at)
		assignment.runs += 1
		if row.total:
			assignment.passed, assignment.total = row.passed, row.total

	for row in frappe.get_all(
		ASSIGNMENT_SUBMISSION,
		filters={"student": ["in", names], "submitted_at": on_the_day, "docstatus": ["<", 2]},
		fields=["student", "assignment", "submitted_at"],
	):
		note(row.student, row.assignment, row.submitted_at).submitted = True

	titles = dict(
		frappe.get_all(
			"CS17 Assignment",
			filters={"name": ["in", [assignment for _, assignment in work] or [""]]},
			fields=["name", "title"],
			as_list=True,
		)
	)
	by_student = {}
	for (student, assignment), row in work.items():
		row.title = titles.get(assignment) or assignment
		by_student.setdefault(student, []).append(row)

	rows = []
	for student in students:
		assignments = sorted(by_student.get(student.student, []), key=lambda row: row.last_active_at)
		rows.append(
			{
				"student": student.student,
				"full_name": student.full_name,
				"opened": len(assignments),
				"typed": sum(row.typed for row in assignments),
				"ran": sum(bool(row.runs) for row in assignments),
				"submitted": sum(row.submitted for row in assignments),
				"last_active_at": assignments[-1].last_active_at if assignments else None,
				"assignments": assignments,
			}
		)
	rows.sort(key=lambda row: (bool(row["opened"]), row["submitted"]))
	return {"date": date, "students": rows}


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=20, seconds=60 * 60, methods=["POST"], ip_based=False, user_based=True)
def remind_students(cohort: str, students: list) -> None:
	if not set(students) <= {student.student for student in get_cohort_students(cohort)}:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	frappe.enqueue(send_reminder, students=sorted(set(students)), enqueue_after_commit=True)


def send_reminder(students: list[str]) -> None:
	alert_students(
		students,
		_("Don't forget your assignments today. Open them and give them a go."),
		"/dashboard/assignments",
	)


@frappe.whitelist(methods=["GET"])
def get_student_day(student: str, date: str | None = None) -> dict:
	require_faculty_for_student(student)
	date = str(getdate(date or today()))
	day_start, day_end = get_datetime(f"{date} 00:00:00"), get_datetime(f"{date} 23:59:59.999999")
	on_the_day = ["between", [date, date]]

	events = [
		{"at": at, "kind": "start"}
		for at in frappe.get_all(
			"CS17 Project",
			filters={"profile": student, "assignment": ["is", "set"], "creation": on_the_day},
			pluck="creation",
		)
	]
	for doctype, at, kind in (("CS17 Code Snapshot", "saved_at", "save"), ("CS17 Code Run", "ran_at", "run")):
		events += [
			{"at": time, "kind": kind}
			for time in {
				time.replace(second=0, microsecond=0)
				for time in frappe.get_all(
					doctype,
					filters={"student": student, "assignment": ["is", "set"], at: on_the_day},
					pluck=at,
				)
			}
		]
	events += [
		{"at": at, "kind": "submit"}
		for at in frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={"student": student, "submitted_at": on_the_day, "docstatus": ["<", 2]},
			pluck="submitted_at",
		)
	]
	events.sort(key=lambda event: event["at"])

	start, end = (
		get_datetime(f"{date} {time}")
		for time in frappe.db.get_value(
			"CS17 Portal Settings", {}, ["practice_hours_start", "practice_hours_end"]
		)
		or ("09:00:00", "21:00:00")
	)
	idle, previous = [], start
	for at in [event["at"] for event in events if start <= event["at"] <= end] + [min(end, now_datetime())]:
		if at >= add_to_date(previous, minutes=IDLE_MINUTES):
			idle.append({"from": previous, "to": at})
		previous = max(previous, at)

	[activity] = summarize_class_activity([frappe._dict(student=student)], date)["students"]
	return {
		"date": date,
		"practice_hours": {"start": start, "end": end},
		"events": events,
		"idle": idle,
		"not_started": get_not_started(student, day_start, day_end),
		"assignments": activity["assignments"],
	}


def get_not_started(student: str, day_start, day_end) -> list:
	started = set(
		frappe.get_all(
			"CS17 Project",
			filters={"profile": student, "assignment": ["is", "set"], "creation": ["<=", day_end]},
			pluck="assignment",
		)
	) | set(
		frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={"student": student, "submitted_at": ["<=", day_end], "docstatus": ["<", 2]},
			pluck="assignment",
		)
	)
	return [
		{"assignment": row.name, "title": row.title, "due_date": row.due_date, "topic": row.topic}
		for row in frappe.get_all(
			"CS17 Assignment",
			filters={
				"cohort": frappe.db.get_value("CS17 Profile", student, "cohort"),
				"coding_exam": ["is", "not set"],
				"creation": ["<=", day_end],
			},
			or_filters=given_to(student),
			fields=["name", "title", "due_date", "topic", "late_until", "is_published", "publish_on"],
			order_by="due_date asc",
		)
		if row.name not in started
		and (row.publish_on <= day_end if row.publish_on else row.is_published)
		and (row.late_until or row.due_date or day_start) >= day_start
	]
