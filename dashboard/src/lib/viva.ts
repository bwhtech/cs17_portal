export interface VivaSummary {
	name: string
	exam_name: string
	subject_name: string
	component: string
	cohort: string
	students: number
	marked: number
}

export interface VivaQuestion {
	name: string
	section: string
	question: string
	code: string | null
	answer: string
	marks: number
	asked: number
}

export interface VivaStudent {
	student: string
	student_name: string
	marks: Record<string, number>
}

export interface Viva {
	name: string
	exam_name: string
	subject_name: string
	component: string
	max_marks: number
	questions: VivaQuestion[]
	students: VivaStudent[]
}

export function vivaSections(questions: VivaQuestion[]): string[] {
	return [...new Set(questions.map((question) => question.section))]
}

/** One question per section: the one asked least so far, the earlier one on a tie. */
export function pickQuestions(questions: VivaQuestion[]): Record<string, string> {
	const picks: Record<string, VivaQuestion> = {}
	for (const question of questions) {
		const pick = picks[question.section]
		if (!pick || question.asked < pick.asked) picks[question.section] = question
	}
	return Object.fromEntries(
		Object.entries(picks).map(([section, question]) => [section, question.name]),
	)
}

export function vivaTotal(marks: Record<string, number>): number {
	return Object.values(marks).reduce((total, value) => total + value, 0)
}
