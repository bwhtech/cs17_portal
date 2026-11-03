import type { Bool } from '@/types'

export type ExamState = 'upcoming' | 'open' | 'in_progress' | 'finished' | 'closed'
export type QuestionState = 'not_started' | 'in_progress' | 'submitted' | 'skipped'
type BadgeTheme = 'gray' | 'blue' | 'green' | 'amber'

export interface CodingExamSummary {
	name: string
	title: string
	opens_on: string
	last_start_on: string
	closes_on: string
	duration_minutes: number
	state: ExamState
}

export interface ExamAttempt {
	started_at: string
	ends_at: string
	is_paused: Bool | boolean
	finished_on: string | null
}

export interface ExamQuestion {
	assignment: string
	title: string
	marks: number
	project: string | null
	state: QuestionState
	is_locked: Bool | boolean
}

export interface CodingExam {
	name: string
	title: string
	instructions: string | null
	duration_minutes: number
	opens_on: string
	last_start_on: string
	closes_on: string
	question_order: 'Any order' | 'One by one'
	can_go_back: Bool | boolean
	banner: string | null
	now: string
	attempt: ExamAttempt | null
	questions: ExamQuestion[]
}

export const EXAM_POLL_MS = 10_000

export const EXAM_STATES: Record<ExamState, { label: string; theme: BadgeTheme }> = {
	upcoming: { label: 'Upcoming', theme: 'blue' },
	open: { label: 'Open', theme: 'green' },
	in_progress: { label: 'In progress', theme: 'amber' },
	finished: { label: 'Finished', theme: 'gray' },
	closed: { label: 'Closed', theme: 'gray' },
}

export const QUESTION_STATES: Record<QuestionState, { label: string; theme: BadgeTheme }> = {
	not_started: { label: 'Not started', theme: 'gray' },
	in_progress: { label: 'In progress', theme: 'amber' },
	submitted: { label: 'Submitted', theme: 'green' },
	skipped: { label: 'Skipped', theme: 'gray' },
}

export function isPassed(question: ExamQuestion): boolean {
	return question.state === 'submitted' || question.state === 'skipped'
}

export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60
	const parts = [
		hours && `${hours} ${hours === 1 ? 'hour' : 'hours'}`,
		rest && `${rest} ${rest === 1 ? 'minute' : 'minutes'}`,
	]
	return parts.filter(Boolean).join(' ')
}

export function marksLabel(marks: number): string {
	return `${marks} ${marks === 1 ? 'mark' : 'marks'}`
}
