import { formatDateTime } from '@/lib/dates'
import { formatGrade } from '@/lib/grades'
import type { CS17ResultAssignmentScore, CS17ResultSummary, FacultyResultSummary } from '@/types'

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

/** "86.5%", to two decimals at most, as the server rounds it. */
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
 * shown as what it is: a letter with its marks, a letter on its own, and
 * nothing at all for work that was never graded. Work that was never handed
 * in has no score to show — the submitted column beside it says why.
 */
export function assignmentScoreLabel(row: CS17ResultAssignmentScore): string {
	if (!row.is_submitted) return '—'
	if (row.evaluation_type === 'Grade') return row.grade || 'Not graded'
	if (row.evaluation_type === 'Marks') {
		if (!row.is_graded) return 'Not graded'
		return formatGrade({
			evaluationType: 'Marks',
			grade: row.grade,
			marksObtained: row.marks_obtained,
			maxMarks: row.max_marks,
		})
	}
	return 'Submitted'
}

/**
 * Unlike a grade, a past `published_on` is not enough: the scheduler refuses a
 * result with marks missing, and students see only `is_published` ones.
 */
export function publishStatus(result: Pick<FacultyResultSummary, 'is_published' | 'published_on'>) {
	if (result.is_published) return { label: 'Published', theme: 'green' } as const
	if (result.published_on) {
		return {
			label: 'Scheduled',
			theme: 'amber',
			title: formatDateTime(result.published_on),
		} as const
	}
	return { label: 'Draft', theme: 'gray' } as const
}

/** The heading a result goes by: its exam, with the quarter when there is one. */
export function resultTitle(result: Pick<CS17ResultSummary, 'exam_name' | 'quarter'>): string {
	return result.quarter ? `${result.exam_name} · ${result.quarter}` : result.exam_name
}

/** Floats arrive as `45.0`; a report card should not show the trailing zero. */
function trim(value: number): string {
	return numberFormat.format(value)
}

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })
