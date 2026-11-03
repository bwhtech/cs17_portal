import type { ExamQuestionState, ExamStudent } from '@/components/exams/faculty/codingExam'
import { formatDateTime, parseDatetime } from '@/lib/dates'

export interface LiveQuestion {
	assignment: string
	title: string | null
}

export interface LiveStudent extends Omit<ExamStudent, 'questions'> {
	questions: {
		assignment: string
		state: ExamQuestionState
		passed: number | null
		total: number | null
	}[]
	current_question: string | null
	last_active_at: string | null
	alerts: number
	stuck: boolean
}

export type ExamEventKind =
	| 'tab_leave'
	| 'window_blur'
	| 'fullscreen_exit'
	| 'paste_blocked'
	| 'paste'
	| 'copy_question'
	| 'split_screen'
	| 'second_screen'
	| 'second_login'
	| 'code_jump'
	| 'rule_action'

export interface ExamEvent {
	name: string
	student: string
	student_name: string | null
	assignment: string | null
	kind: ExamEventKind
	occurred_at: string
	seconds: number
	detail: string | null
	modified: string
}

export interface ExamLive {
	title: string
	now: string
	questions: LiveQuestion[]
	students: LiveStudent[]
	events: ExamEvent[]
}

export const QUESTION_STATES: Record<
	ExamQuestionState,
	{ label: string; theme: 'gray' | 'blue' | 'green' | 'amber' }
> = {
	not_started: { label: 'Not started', theme: 'gray' },
	in_progress: { label: 'In progress', theme: 'blue' },
	submitted: { label: 'Submitted', theme: 'green' },
	skipped: { label: 'Skipped', theme: 'amber' },
}

function duration(seconds: number): string {
	const rounded = Math.round(seconds)
	return rounded < 60 ? `${rounded} s` : `${Math.round(rounded / 60)} min`
}

const ALERT_TEXT: Record<ExamEventKind, (name: string, event: ExamEvent) => string> = {
	tab_leave: (name, event) =>
		event.seconds ? `${name} left the tab for ${duration(event.seconds)}` : `${name} left the tab`,
	window_blur: (name, event) =>
		event.seconds
			? `${name} left the exam window for ${duration(event.seconds)}`
			: `${name} left the exam window`,
	fullscreen_exit: (name) => `${name} left full screen`,
	paste_blocked: (name, event) => `${name} tried to paste ${event.detail} from outside the exam`,
	paste: (name, event) => `${name} pasted ${event.detail} from outside the exam`,
	copy_question: (name) => `${name} copied the question text`,
	split_screen: (name) => `${name} shrank the exam window`,
	second_screen: (name) => `${name} has a second screen`,
	second_login: (name) => `${name} is signed in somewhere else too`,
	code_jump: (name, event) =>
		`${name} added ${event.detail} in ${duration(event.seconds)} without pasting`,
	rule_action: (name, event) => `${name}: ${event.detail}`,
}

export function questionNumber(questions: LiveQuestion[], assignment: string): string {
	return `Question ${questions.findIndex((question) => question.assignment === assignment) + 1}`
}

export function alertText(event: ExamEvent, questions: LiveQuestion[]): string {
	const text = ALERT_TEXT[event.kind](event.student_name ?? event.student, event)
	return event.assignment ? `${text}, ${questionNumber(questions, event.assignment)}` : text
}

function minutesBetween(from: string, to: string): number {
	return (parseDatetime(to).valueOf() - parseDatetime(from).valueOf()) / 60_000
}

export function activeSince(at: string, now: string): string {
	const minutes = Math.floor(minutesBetween(at, now))
	if (minutes < 1) return 'Active just now'
	if (minutes < 60) return `Active ${minutes} min ago`
	return `Active ${formatDateTime(at)}`
}

export function timeLeft(endsAt: string, now: string): string {
	const minutes = Math.ceil(minutesBetween(now, endsAt))
	return minutes > 0 ? `${minutes} min left` : 'Time up'
}
