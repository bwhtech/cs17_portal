import { isPast } from '@/lib/dates'
import type { CS17Assignment, CS17Grade, CS17Submission } from '@/types'

/**
 * The student's view of an assignment. Three surfaces show it — the dashboard
 * card, the assignments table and the detail page — so the ladder is derived
 * here once and never re-derived at a call site.
 */
export type AssignmentStatus = 'Pending' | 'Submitted' | 'Closed'

/**
 * The ladder, in order: a graded assignment is done with; a submission that
 * has not been graded yet is Submitted; a passed due date closes an
 * assignment that was never submitted to; everything else is still open.
 */
export function assignmentStatus(
	assignment: Pick<CS17Assignment, 'due_date'>,
	submission?: CS17Submission | null,
	grade?: CS17Grade | null,
): AssignmentStatus {
	if (grade) return 'Closed'
	if (submission) return 'Submitted'
	if (isPast(assignment.due_date)) return 'Closed'
	return 'Pending'
}

/** Badge theme for each rung, so the three surfaces also agree on color. */
export function assignmentStatusTheme(status: AssignmentStatus): 'gray' | 'green' | 'amber' {
	if (status === 'Submitted') return 'green'
	if (status === 'Pending') return 'amber'
	return 'gray'
}

/**
 * Grades the student is allowed to see for their own work.
 *
 * A grade counts when its `submission` is one of theirs. Rows written before
 * the `submission` link existed have none, and for those the assignment
 * having a submission of the student's own is the best available proof.
 */
export function visibleGrades(grades: CS17Grade[], submissions: CS17Submission[]): CS17Grade[] {
	const ownSubmissions = new Set(submissions.map((s) => s.name))
	const assignmentsSubmittedTo = new Set(submissions.map((s) => s.assignment))
	return grades.filter((grade) =>
		grade.submission
			? ownSubmissions.has(grade.submission)
			: Boolean(grade.assignment && assignmentsSubmittedTo.has(grade.assignment)),
	)
}

/** The visible grades keyed by assignment, the shape every table wants. */
export function gradesByAssignment(
	grades: CS17Grade[],
	submissions: CS17Submission[],
): Record<string, CS17Grade> {
	const map: Record<string, CS17Grade> = {}
	for (const grade of visibleGrades(grades, submissions)) {
		if (grade.assignment) map[grade.assignment] = grade
	}
	return map
}

/** Submissions keyed by assignment — the other half of every table's input. */
export function submissionsByAssignment(
	submissions: CS17Submission[],
): Record<string, CS17Submission> {
	const map: Record<string, CS17Submission> = {}
	for (const submission of submissions) map[submission.assignment] = submission
	return map
}
