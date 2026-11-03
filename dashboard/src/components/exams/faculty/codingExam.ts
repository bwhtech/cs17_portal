import { formatDateTime, parseDatetime } from '@/lib/dates'

export type QuestionOrder = 'Any order' | 'One by one'

export type PasteRule = 'Allow' | 'Log' | 'Block outside code'

export type LeaveAction = 'Flag' | 'Lock question' | 'Submit exam'

export type CodingExamState = 'draft' | 'upcoming' | 'open' | 'closed'

export interface CodingExamSummary {
	name: string
	title: string
	cohort: string
	quarter: string | null
	opens_on: string
	last_start_on: string
	closes_on: string
	duration_minutes: number
	question_count: number
	is_published: 0 | 1
	state: CodingExamState
}

export interface CodingExamQuestion {
	assignment: string
	title: string
	marks: number
	max_marks: number | null
}

export interface CodingExamChange {
	student: string | null
	student_name: string | null
	change: string
	changed_by: string
	changed_by_name: string | null
	changed_on: string
}

export interface CodingExam {
	name: string
	title: string
	cohort: string
	quarter: string | null
	instructions: string | null
	duration_minutes: number
	opens_on: string
	last_start_on: string
	closes_on: string
	question_order: QuestionOrder
	can_go_back: 0 | 1
	banner: string | null
	require_fullscreen: 0 | 1
	count_window_switches: 0 | 1
	paste_rule: PasteRule
	watch_copy: 0 | 1
	leave_limit: number
	leave_seconds: number
	leave_action: LeaveAction
	alert_kinds: string | null
	require_seb: 0 | 1
	has_seb_key: boolean
	is_published: 0 | 1
	has_attempts: boolean
	questions: CodingExamQuestion[]
	changes: CodingExamChange[]
}

export type AttemptState = 'not_started' | 'in_progress' | 'finished'

export type ExamQuestionState = 'not_started' | 'in_progress' | 'submitted' | 'skipped'

export interface ExamStudent {
	student: string
	full_name: string | null
	state: AttemptState
	started_at: string | null
	ends_at: string | null
	is_paused: boolean
	extra_minutes: number
	questions: { assignment: string; state: ExamQuestionState }[]
	total_marks: number | null
	max_marks: number
}

export const EXAM_STATES: Record<
	CodingExamState,
	{ label: string; theme: 'gray' | 'amber' | 'green' }
> = {
	draft: { label: 'Draft', theme: 'gray' },
	upcoming: { label: 'Upcoming', theme: 'amber' },
	open: { label: 'Open', theme: 'green' },
	closed: { label: 'Closed', theme: 'gray' },
}

export function formatMinutes(minutes: number): string {
	return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}

export function formatExamWindow(opensOn: string, closesOn: string): string {
	const closes = parseDatetime(closesOn)
	const sameDay = parseDatetime(opensOn).format('YYYY-MM-DD') === closes.format('YYYY-MM-DD')
	return `${formatDateTime(opensOn)} to ${sameDay ? closes.format('h:mm A') : formatDateTime(closesOn)}`
}
