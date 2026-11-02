import frappe
from frappe import _
from frappe.utils import flt

from cs17_portal.api import (
	ASSIGNMENT_SUBMISSION,
	get_cohort_students,
	get_current_faculty,
	given_to,
	is_published_now,
	require_current_student,
)


@frappe.whitelist(methods=["GET"])
def get_student_topic_progress(student: str) -> list:
	faculty = get_current_faculty()
	profile = frappe.db.get_value(
		"CS17 Profile", {"name": student, "profile_type": "Student"}, "cohort", as_dict=True
	)
	if not profile:
		frappe.throw(_("Student not found"), frappe.DoesNotExistError)
	if faculty.cohort and faculty.cohort != profile.cohort:
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	return _student_progress(student, profile.cohort, _("No topic"))


@frappe.whitelist(methods=["GET"])
def get_my_topic_progress() -> list:
	student = require_current_student()
	return _student_progress(student, frappe.db.get_value("CS17 Profile", student, "cohort"), _("Other"))


@frappe.whitelist(methods=["GET"])
def get_class_topic_progress(cohort: str, quarter: str | None = None) -> list:
	students = {student.student for student in get_cohort_students(cohort)}
	assignments = _published_marks_assignments(
		{"cohort": cohort, "quarter": quarter} if quarter else {"cohort": cohort}
	)
	given = {}
	for row in frappe.get_all(
		"CS17 Assignment Student",
		filters={
			"parent": ("in", [assignment.name for assignment in assignments]),
			"parenttype": "CS17 Assignment",
		},
		fields=["parent", "student"],
	):
		given.setdefault(row.parent, set()).add(row.student)
	return _progress_by_topic(
		assignments,
		{assignment.name: (given.get(assignment.name) or students) & students for assignment in assignments},
		_("No topic"),
	)


def _student_progress(student: str, cohort: str | None, no_topic: str) -> list:
	assignments = _published_marks_assignments({"cohort": cohort}, given_to(student))
	return _progress_by_topic(
		assignments, {assignment.name: {student} for assignment in assignments}, no_topic
	)


def _published_marks_assignments(filters: dict, or_filters: list | None = None) -> list:
	return [
		assignment
		for assignment in frappe.get_all(
			"CS17 Assignment",
			filters={**filters, "assignment_type": "Graded", "remarks": "Marks"},
			or_filters=or_filters,
			fields=["name", "topic", "max_marks", "is_published", "publish_on"],
			order_by="due_date desc, creation desc",
		)
		if is_published_now(assignment)
	]


def _progress_by_topic(assignments: list, students_by_assignment: dict, no_topic: str) -> list:
	submissions = {
		(submission.assignment, submission.student): submission.name
		for submission in frappe.get_all(
			ASSIGNMENT_SUBMISSION,
			filters={
				"assignment": ("in", list(students_by_assignment)),
				"student": ("in", list(set().union(*students_by_assignment.values()))),
				"docstatus": ("<", 2),
			},
			fields=["name", "assignment", "student"],
		)
	}
	published_marks = {
		grade.submission: flt(grade.marks_obtained)
		for grade in frappe.get_all(
			"CS17 Assignment Grade",
			filters={"submission": ("in", list(submissions.values()))},
			fields=["submission", "marks_obtained", "is_published", "published_on"],
		)
		if is_published_now(grade, "published_on")
	}

	topics = {}
	for assignment in assignments:
		topic = topics.setdefault(
			assignment.topic or no_topic, frappe._dict(given=0, submitted=0, marks_obtained=0, max_marks=0)
		)
		for student in students_by_assignment[assignment.name]:
			topic.given += 1
			submission = submissions.get((assignment.name, student))
			if not submission:
				continue
			topic.submitted += 1
			if submission in published_marks:
				topic.marks_obtained += published_marks[submission]
				topic.max_marks += flt(assignment.max_marks)
	return [
		{
			"topic": name,
			"given": topic.given,
			"submitted": topic.submitted,
			"average": flt(topic.marks_obtained * 100 / topic.max_marks, 2) if topic.max_marks else None,
		}
		for name, topic in topics.items()
	]
