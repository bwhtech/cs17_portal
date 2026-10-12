import type { EvaluationType, GradeBand } from '@/types'

const marksFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatGrade({
	evaluationType,
	grade,
	marksObtained,
	maxMarks,
}: {
	evaluationType?: EvaluationType | null
	grade?: string | null
	marksObtained?: number | null
	maxMarks?: number | null
}): string {
	if (evaluationType !== 'Marks') return grade || '—'
	const marks = `${marksFormat.format(marksObtained ?? 0)} / ${marksFormat.format(maxMarks ?? 0)}`
	return grade ? `${grade} · ${marks}` : marks
}

export function gradeForMarks(bands: GradeBand[], marks: string, maxMarks = 0): string {
	const value = Number(marks)
	if (marks.trim() === '' || value < 0 || value > maxMarks) return ''
	const percentage = maxMarks ? Math.round((value * 10000) / maxMarks) / 100 : 0
	const reached = bands.filter((band) => band.min_percent <= percentage)
	if (!reached.length) return ''
	return reached.reduce((highest, band) =>
		band.min_percent > highest.min_percent ? band : highest,
	).grade
}
