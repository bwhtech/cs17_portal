import type { CS17ResultAssignmentScore, CS17ResultSummary } from '@/types'

/**
 * How a result reads. The list and the detail page both show marks, a
 * percentage and a pass/fail, so the formatting lives here once — a report
 * card that disagreed with itself between two screens would be alarming.
 */

/** "45 / 50". Marks are Floats, so a whole number is shown without its `.0`. */
export function formatMarks(obtained?: number | null, max?: number | null): string {
	if (obtained === null || obtained === undefined) return '—'
	return max ? `${trim(obtained)} / ${trim(max)}` : trim(obtained)
}

/** "86.5%", to one decimal at most. */
export function formatPercent(value?: number | null): string {
	if (value === null || value === undefined) return '—'
	return `${trim(value)}%`
}

/** Badge theme for `result_status` and the per-subject `is_pass`. */
export function passTheme(passed: boolean): 'green' | 'red' {
	return passed ? 'green' : 'red'
}

/**
 * What an assignment row scored, in one string.
 *
 * The three evaluation types have nothing in common to average, so each is
 * shown as what it is: marks against their total, a letter on its own, and
 * nothing at all for work that was never graded. Work that was never handed
 * in has no score to show — the submitted column beside it says why.
 */
export function assignmentScoreLabel(row: CS17ResultAssignmentScore): string {
	if (!row.is_submitted) return '—'
	if (row.evaluation_type === 'Grade') return row.grade || 'Not graded'
	if (row.evaluation_type === 'Marks') {
		if (row.marks_obtained === null || row.marks_obtained === undefined) return 'Not graded'
		return formatMarks(row.marks_obtained, row.max_marks)
	}
	return 'Submitted'
}

/** The heading a result goes by: its exam, with the quarter when there is one. */
export function resultTitle(result: Pick<CS17ResultSummary, 'exam_name' | 'quarter'>): string {
	return result.quarter ? `${result.exam_name} · ${result.quarter}` : result.exam_name
}

/** Floats arrive as `45.0`; a report card should not show the trailing zero. */
function trim(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
