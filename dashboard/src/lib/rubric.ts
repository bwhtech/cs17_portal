import type { CS17Assignment, CS17Grade } from '@/types'

export type RubricCriterion = NonNullable<CS17Assignment['rubric']>[number]
export type RubricScore = NonNullable<CS17Grade['rubric_scores']>[number]

export function rubricTotal(marks: (string | number)[]): number {
	return (
		Math.round(marks.reduce<number>((total, mark) => total + (Number(mark) || 0), 0) * 100) / 100
	)
}

/** Each criterion's saved marks, or empty where the rubric has changed since. */
export function savedRubricMarks(rubric: RubricCriterion[], scores: RubricScore[] = []): string[] {
	return rubric.map((row, index) =>
		scores[index]?.criterion === row.criterion ? String(scores[index].marks) : '',
	)
}

export function rubricMarksErrors(rubric: RubricCriterion[], marks: string[]): string[] {
	return rubric.map((row, index) => {
		const raw = String(marks[index] ?? '').trim()
		const value = Number(raw)
		if (raw === '') return 'Enter the marks.'
		if (Number.isNaN(value)) return 'Marks must be a number.'
		if (value < 0) return 'Marks cannot be negative.'
		return value > row.marks ? `Marks cannot exceed ${row.marks}.` : ''
	})
}

export function rubricScores(rubric: RubricCriterion[], marks: string[]) {
	return rubric.map((row, index) => ({ criterion: row.criterion, marks: Number(marks[index]) }))
}
