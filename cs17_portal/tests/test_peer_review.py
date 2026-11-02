# Copyright (c) 2026, developers@bwh.tech and Contributors
# See license.txt

from collections import Counter
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from cs17_portal import demo, peer_review
from cs17_portal.api import ASSIGNMENT_SUBMISSION
from cs17_portal.cs17_portal.doctype.cs17_assignment.cs17_assignment import notify_students
from cs17_portal.tests.test_api import make_assignment, make_cohort, make_profile, make_submission, make_user

PEER_REVIEW = "CS17 Peer Review"


class TestPeerReview(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.cohort = make_cohort("C1380TEST")
		cls.faculty_user = make_user("faculty1380@cs17test.com")
		make_profile("Faculty", cls.cohort, cls.faculty_user, "Kavita Rao")
		cls.student_user = make_user("student1381@cs17test.com")
		cls.classmate_user = make_user("student1382@cs17test.com")
		cls.third_student_user = make_user("student1383@cs17test.com")
		cls.student = make_profile("Student", cls.cohort, cls.student_user, "Aarav Sharma")
		cls.classmate = make_profile("Student", cls.cohort, cls.classmate_user, "Diya Menon")
		cls.third_student = make_profile("Student", cls.cohort, cls.third_student_user, "Kabir Rao")

	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(self.faculty_user)
		self.assignment = make_assignment(self.cohort, "Loops practice", "Python", 20)
		frappe.db.set_value("CS17 Assignment", self.assignment, "due_date", "2026-01-01 00:00:00")
		self.submission = self.submit(
			self.student, "Aarav Sharma", "for number in range(1, 6):\n\tprint(number)\n"
		)
		self.classmate_submission = self.submit(self.classmate, "Diya Menon", "print(*range(1, 6))\n")

	def submit(self, student: str, full_name: str, code: str) -> str:
		submission = make_submission(self.assignment, student, full_name, "Loops practice")
		frappe.db.set_value(ASSIGNMENT_SUBMISSION, submission, "code", code)
		return submission

	def start(self, reviewers_per_submission: int = 2) -> None:
		frappe.set_user(self.faculty_user)
		with patch.object(frappe, "enqueue"):
			peer_review.start_peer_review(self.assignment, reviewers_per_submission)

	def write_review(self) -> str:
		frappe.set_user(self.student_user)
		review = peer_review.get_reviews_to_write(self.assignment)[0].name
		peer_review.submit_review(review, "Clear names for every variable.", "Print the numbers on one line.")
		return review

	def share(self) -> None:
		frappe.set_user(self.faculty_user)
		with patch.object(frappe, "enqueue"):
			peer_review.share_peer_reviews(self.assignment)

	def reviews(self) -> list:
		return frappe.get_all(
			PEER_REVIEW,
			filters={"assignment": self.assignment},
			fields=["reviewer", "submission.student as author"],
		)

	def test_start_is_refused_before_the_late_work_deadline(self):
		frappe.db.set_value("CS17 Assignment", self.assignment, "late_until", "2030-01-01 00:00:00")

		self.assertRaisesRegex(
			frappe.ValidationError,
			"Start peer review after the deadline, so nobody sees an answer early.",
			peer_review.start_peer_review,
			self.assignment,
		)

	def test_each_student_reviews_two_classmates_and_never_their_own_work(self):
		self.submit(self.third_student, "Kabir Rao", "print(1, 2, 3, 4, 5)\n")

		self.start(2)

		reviews = self.reviews()
		students = [self.student, self.classmate, self.third_student]
		self.assertEqual(Counter(review.reviewer for review in reviews), Counter(dict.fromkeys(students, 2)))
		self.assertEqual(Counter(review.author for review in reviews), Counter(dict.fromkeys(students, 2)))
		self.assertFalse([review for review in reviews if review.reviewer == review.author])

	def test_two_students_review_each_other_once(self):
		self.start(2)

		self.assertCountEqual(
			[(review.reviewer, review.author) for review in self.reviews()],
			[(self.student, self.classmate), (self.classmate, self.student)],
		)

	def test_starting_twice_is_refused(self):
		self.start()

		self.assertRaisesRegex(frappe.ValidationError, "Peer review has already started.", self.start)

	def test_starting_notifies_the_reviewers(self):
		with patch.object(frappe, "enqueue") as enqueue:
			peer_review.start_peer_review(self.assignment)

		enqueue.assert_called_once_with(
			notify_students,
			assignment=self.assignment,
			students=sorted([self.student, self.classmate]),
			subject="Review your classmates: Loops practice",
			enqueue_after_commit=True,
		)

	def test_faculty_of_another_cohort_cannot_start(self):
		other_faculty = make_user("faculty1384@cs17test.com")
		make_profile("Faculty", make_cohort("C1384TEST"), other_faculty, "Meera Iyer")

		frappe.set_user(other_faculty)
		self.assertRaises(frappe.PermissionError, peer_review.start_peer_review, self.assignment)

	def test_reviews_to_write_never_name_the_classmate(self):
		self.start()

		frappe.set_user(self.student_user)
		self.assertEqual(set(peer_review.get_reviews_to_write(self.assignment)[0]), {"name", "submitted_on"})

	def test_the_reviewer_reads_the_classmates_code(self):
		self.start()

		frappe.set_user(self.student_user)
		review = peer_review.get_reviews_to_write(self.assignment)[0].name
		self.assertEqual(peer_review.get_review_code(review), "print(*range(1, 6))\n")

	def test_another_student_cannot_read_the_code(self):
		self.start()
		frappe.set_user(self.student_user)
		review = peer_review.get_reviews_to_write(self.assignment)[0].name

		frappe.set_user(self.third_student_user)
		self.assertRaises(frappe.DoesNotExistError, peer_review.get_review_code, review)

	def test_a_reviewer_whose_work_is_sent_back_cannot_read_the_code(self):
		self.start()
		frappe.db.set_value(ASSIGNMENT_SUBMISSION, self.submission, "returned_on", "2026-01-02 00:00:00")

		frappe.set_user(self.student_user)
		review = peer_review.get_reviews_to_write(self.assignment)[0].name
		self.assertRaisesRegex(
			frappe.ValidationError,
			"Review your classmates once your own work is closed.",
			peer_review.get_review_code,
			review,
		)

	def test_a_short_answer_is_refused(self):
		self.start()

		frappe.set_user(self.student_user)
		review = peer_review.get_reviews_to_write(self.assignment)[0].name
		self.assertRaisesRegex(
			frappe.ValidationError,
			"Write at least 15 characters in each answer.",
			peer_review.submit_review,
			review,
			"Clear names for every variable.",
			"Looks good.",
		)

	def test_a_review_is_sent_once(self):
		self.start()
		review = self.write_review()

		self.assertRaisesRegex(
			frappe.ValidationError,
			"You already sent this review.",
			peer_review.submit_review,
			review,
			"Clear names for every variable.",
			"Print the numbers on one line.",
		)

	def test_the_author_reads_a_review_only_once_it_is_shared(self):
		self.start()
		self.write_review()
		frappe.set_user(self.classmate_user)
		self.assertEqual(peer_review.get_reviews_of_my_work(self.assignment), [])

		self.share()

		frappe.set_user(self.classmate_user)
		[review] = peer_review.get_reviews_of_my_work(self.assignment)
		self.assertEqual(
			(set(review), review.strengths, review.improvement),
			(
				{"name", "strengths", "improvement"},
				"Clear names for every variable.",
				"Print the numbers on one line.",
			),
		)

	def test_sharing_notifies_the_authors_of_written_reviews(self):
		self.start()
		self.write_review()

		frappe.set_user(self.faculty_user)
		with patch.object(frappe, "enqueue") as enqueue:
			peer_review.share_peer_reviews(self.assignment)

		enqueue.assert_called_once_with(
			notify_students,
			assignment=self.assignment,
			students=[self.classmate],
			subject="Your classmates reviewed: Loops practice",
			enqueue_after_commit=True,
		)

	def test_faculty_removes_a_review(self):
		self.start()
		review = self.write_review()

		frappe.set_user(self.faculty_user)
		peer_review.remove_peer_review(review)

		self.assertFalse(frappe.db.exists(PEER_REVIEW, review))

	def test_wipe_deletes_peer_reviews_on_a_demo_students_submission(self):
		cohort = make_cohort("C1385TEST")
		student = make_profile("Student", cohort, make_user("student1385@demo.cs17test.com"), "Ishaan Gupta")
		assignment = make_assignment(cohort, "Loops practice", "Python", 20)
		submission = make_submission(assignment, student, "Ishaan Gupta", "Loops practice")
		review = (
			frappe.get_doc(
				{
					"doctype": PEER_REVIEW,
					"assignment": assignment,
					"submission": submission,
					"reviewer": student,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

		with (
			patch.multiple(demo, DOMAIN="@demo.cs17test.com", COHORT_NOW=cohort, COHORT_PAST=cohort),
			patch.object(frappe.db, "commit"),
			patch.object(frappe.db, "rollback"),
		):
			demo.wipe()

		self.assertFalse(frappe.db.exists(PEER_REVIEW, review))
