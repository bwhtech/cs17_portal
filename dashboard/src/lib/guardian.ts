import { formatGrade } from '@/lib/grades'
import { formatPercent } from '@/lib/results'
import type { CS17Grade, CS17Submission, EvaluationType } from '@/types'

export interface GuardianAssignment {
	name: string
	title: string
	due_date: string
	late_until: string | null
	assignment_type: string
	remarks: EvaluationType | '' | null
	max_marks: number | null
	submission: Pick<CS17Submission, 'name' | 'student' | 'submitted_at' | 'returned_on'> | null
	grade: Pick<CS17Grade, 'evaluation_type' | 'marks_obtained' | 'grade' | 'remarks'> | null
}

export interface GuardianChild {
	student: string
	full_name: string
	cohort: string | null
	profile_picture: string | null
	average: number | null
	grade: string | null
}

export function gradeLabel(assignment: GuardianAssignment): string {
	if (!assignment.grade?.evaluation_type) return 'Remarks'
	return formatGrade({
		evaluationType: assignment.grade.evaluation_type,
		grade: assignment.grade.grade,
		marksObtained: assignment.grade.marks_obtained,
		maxMarks: assignment.max_marks,
	})
}

export function averageLabel(child: Pick<GuardianChild, 'average' | 'grade'>): string {
	return [formatPercent(child.average), child.grade].filter(Boolean).join(' · ')
}
