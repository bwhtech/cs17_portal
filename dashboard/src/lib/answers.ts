import type { AnswerResult, AnswerStatus } from '@/types'

export const ANSWER_STATUSES: { label: string; value: AnswerStatus }[] = [
	{ label: 'Correct', value: 'Correct' },
	{ label: 'Half', value: 'Half' },
	{ label: 'Incorrect', value: 'Incorrect' },
	{ label: 'Not scored', value: '' },
]

const THEMES = { Correct: 'green', Half: 'amber', Incorrect: 'red', '': 'gray' } as const

export function answerBadge(status: AnswerStatus) {
	return { label: status || 'Not scored', theme: THEMES[status] }
}

export function answerCounts(results: Pick<AnswerResult, 'status'>[]): string {
	if (!results.some((row) => row.status)) return ''
	const count = (status: AnswerStatus) => results.filter((row) => row.status === status).length
	return `${count('Correct')} correct · ${count('Half')} half · ${count('Incorrect')} incorrect`
}
