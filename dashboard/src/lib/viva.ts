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

/** One question per section, at random from those asked least so far. */
export function pickQuestions(questions: VivaQuestion[]): Record<string, string> {
	return Object.fromEntries(
		vivaSections(questions).map((section) => {
			const inSection = questions.filter((question) => question.section === section)
			const fewest = Math.min(...inSection.map((question) => question.asked))
			const choices = inSection.filter((question) => question.asked === fewest)
			return [section, choices[Math.floor(Math.random() * choices.length)].name]
		}),
	)
}

export function vivaTotal(marks: Record<string, number>): number {
	return Object.values(marks).reduce((total, value) => total + value, 0)
}
