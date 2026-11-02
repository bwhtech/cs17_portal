import random

import frappe
from frappe import _
from frappe.utils import now_datetime

from cs17_portal.api import (
	ASSIGNMENT_SUBMISSION,
	get_deadline,
	is_assignment_closed,
	require_current_student,
	require_faculty_for_assignment,
)
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import notify_students

PEER_REVIEW = "CS17 Peer Review"
MIN_ANSWER_LENGTH = 15


@frappe.whitelist(methods=["POST"])
def start_peer_review(assignment: str, reviewers_per_submission: int = 2) -> None:
	require_faculty_for_assignment(assignment)
	assignment_doc = frappe.db.get_value(
		"CS17 Assignment", assignment, ["submission_type", "title"], as_dict=True, for_update=True
	)
	if not assignment_doc:
		frappe.throw(_("Assignment not found"), frappe.DoesNotExistError)
	if assignment_doc.submission_type != "Python":
		frappe.throw(_("Peer review is for Python assignments."))
	if not 1 <= reviewers_per_submission <= 3:
		frappe.throw(_("Pick 1 to 3 reviewers per submission."))
	deadline = get_deadline(assignment)
	if not deadline or now_datetime() <= deadline:
		frappe.throw(_("Start peer review after the deadline, so nobody sees an answer early."))
	if frappe.db.exists(PEER_REVIEW, {"assignment": assignment}):
		frappe.throw(_("Peer review has already started."))

	submissions = frappe.get_all(
		ASSIGNMENT_SUBMISSION, filters={"assignment": assignment}, fields=["name", "student"]
	)
	if len(submissions) < 2:
		frappe.throw(_("Peer review needs at least two submissions."))
	random.shuffle(submissions)
	reviewers_per_submission = min(reviewers_per_submission, len(submissions) - 1)
	for index, reviewer in enumerate(submissions):
		for offset in range(1, reviewers_per_submission + 1):
			frappe.get_doc(
				{
					"doctype": PEER_REVIEW,
					"assignment": assignment,
					"submission": submissions[(index + offset) % len(submissions)].name,
					"reviewer": reviewer.student,
				}
			).insert(ignore_permissions=True)
	frappe.enqueue(
		notify_students,
		assignment=assignment,
		students=sorted(submission.student for submission in submissions),
		subject=_("Review your classmates: {0}").format(assignment_doc.title),
		enqueue_after_commit=True,
	)


@frappe.whitelist(methods=["GET"])
def get_peer_reviews(assignment: str) -> list:
	require_faculty_for_assignment(assignment)
	reviews = frappe.get_all(
		PEER_REVIEW,
		filters={"assignment": assignment},
		fields=[
			"name",
			"submission",
			"submission.full_name as student_name",
			"reviewer.full_name as reviewer_name",
			"strengths",
			"improvement",
			"submitted_on",
			"shared_on",
		],
	)
	return sorted(reviews, key=lambda review: (review.student_name or "", review.reviewer_name or ""))


@frappe.whitelist(methods=["POST"])
def share_peer_reviews(assignment: str) -> None:
	require_faculty_for_assignment(assignment)
	unshared = {"assignment": assignment, "submitted_on": ["is", "set"], "shared_on": ["is", "not set"]}
	authors = {
		review.student
		for review in frappe.get_all(PEER_REVIEW, filters=unshared, fields=["submission.student as student"])
	}
	if not authors:
		frappe.throw(_("There are no new reviews to share."))
	frappe.db.set_value(PEER_REVIEW, unshared, "shared_on", now_datetime())
	frappe.enqueue(
		notify_students,
		assignment=assignment,
		students=sorted(authors),
		subject=_("Your classmates reviewed: {0}").format(
			frappe.db.get_value("CS17 Assignment", assignment, "title")
		),
		enqueue_after_commit=True,
	)


@frappe.whitelist(methods=["POST"])
def remove_peer_review(review: str) -> None:
	assignment = frappe.db.get_value(PEER_REVIEW, review, "assignment")
	if not assignment:
		frappe.throw(_("Review not found"), frappe.DoesNotExistError)
	require_faculty_for_assignment(assignment)
	frappe.delete_doc(PEER_REVIEW, review, ignore_permissions=True)


@frappe.whitelist(methods=["GET"])
def get_reviews_to_write(assignment: str) -> list:
	return frappe.get_all(
		PEER_REVIEW,
		filters={"assignment": assignment, "reviewer": require_current_student()},
		fields=["name", "submitted_on"],
		order_by="creation asc",
	)


def require_assigned_review(review: str) -> "frappe.model.document.Document":
	review_doc = frappe.get_doc(PEER_REVIEW, review)
	if review_doc.reviewer != require_current_student():
		frappe.throw(_("Review not found"), frappe.DoesNotExistError)
	return review_doc


@frappe.whitelist(methods=["GET"])
def get_review_code(review: str) -> str:
	review_doc = require_assigned_review(review)
	if not is_assignment_closed(review_doc.assignment):
		frappe.throw(_("Review your classmates once your own work is closed."))
	return frappe.db.get_value(ASSIGNMENT_SUBMISSION, review_doc.submission, "code") or ""


@frappe.whitelist(methods=["POST"])
def submit_review(review: str, strengths: str, improvement: str) -> None:
	review_doc = require_assigned_review(review)
	if review_doc.submitted_on:
		frappe.throw(_("You already sent this review."))
	strengths, improvement = strengths.strip(), improvement.strip()
	if len(strengths) < MIN_ANSWER_LENGTH or len(improvement) < MIN_ANSWER_LENGTH:
		frappe.throw(_("Write at least {0} characters in each answer.").format(MIN_ANSWER_LENGTH))
	review_doc.update({"strengths": strengths, "improvement": improvement, "submitted_on": now_datetime()})
	review_doc.save(ignore_permissions=True)


@frappe.whitelist(methods=["GET"])
def get_reviews_of_my_work(assignment: str) -> list:
	return frappe.get_all(
		PEER_REVIEW,
		filters=[
			["assignment", "=", assignment],
			["submission.student", "=", require_current_student()],
			["shared_on", "is", "set"],
		],
		fields=["name", "strengths", "improvement"],
		order_by="shared_on asc, creation asc",
	)
