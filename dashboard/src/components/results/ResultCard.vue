<template>
	<div class="space-y-6">
		<!-- The headline: the numbers a student looks for before anything
		     else, in one panel above the subject-by-subject breakdown. -->
		<section class="rounded-4 border border-outline-gray-1 p-5">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="min-w-0">
					<p class="text-sm text-ink-gray-5">{{ metaLine }}</p>
				</div>
				<Badge
					v-if="result.result_status"
					:label="result.result_status"
					:theme="passTheme(result.result_status === 'Pass')"
					variant="subtle"
					size="lg"
				/>
			</div>

			<div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
				<div>
					<p class="text-xs text-ink-gray-5">Total marks</p>
					<p class="mt-0.5 text-lg text-ink-gray-9">
						{{ formatMarks(result.total_marks_obtained, result.total_max_marks) }}
					</p>
				</div>
				<div>
					<p class="text-xs text-ink-gray-5">Percentage</p>
					<p class="mt-0.5 text-lg text-ink-gray-9">
						{{ formatPercent(result.percentage) }}
					</p>
				</div>
				<div>
					<p class="text-xs text-ink-gray-5">Overall grade</p>
					<p class="mt-0.5 text-lg text-ink-gray-9">
						{{ result.overall_grade || '—' }}
					</p>
				</div>
			</div>
		</section>

		<!-- Subjects carry their own grading scale, so the per-subject grade
		     is the meaningful output — the overall one above is a summary. -->
		<section class="space-y-3">
			<h2 class="text-base-medium text-ink-gray-8">Subjects</h2>
			<DataTable
				:columns="subjectColumns"
				:rows="subjectRows"
				:row-key="subjectKey"
				empty="No subjects on this result."
			>
				<template #cell-subject="{ row }">
					<RowTitle
						v-if="row.kind === 'subject'"
						:title="row.subject_name || row.subject"
					/>
					<span
						v-else
						class="truncate text-base"
						:class="row.nested ? 'pl-8 text-ink-gray-6' : 'pl-4 text-ink-gray-7'"
					>
						{{ row.label }}
					</span>
				</template>

				<template #cell-marks="{ row }">
					{{ formatMarks(row.marks_obtained, row.max_marks) }}
				</template>

				<template #cell-percentage="{ row }">
					<template v-if="row.kind === 'subject'">{{
						formatPercent(row.percentage)
					}}</template>
				</template>

				<template #cell-grade="{ row }">
					<span v-if="row.kind === 'subject'" class="text-base text-ink-gray-8">
						{{ row.grade || '—' }}
					</span>
				</template>

				<template #cell-is_pass="{ row }">
					<Badge
						v-if="row.kind === 'subject'"
						:label="row.is_pass ? 'Pass' : 'Fail'"
						:theme="passTheme(Boolean(row.is_pass))"
						variant="subtle"
					/>
				</template>
			</DataTable>
		</section>

		<!-- Reported, not counted: the quarter's assignments sit beside the
		     exam and contribute nothing to the totals above. -->
		<section v-if="result.assignments.length" class="space-y-3">
			<div>
				<h2 class="text-base-medium text-ink-gray-8">
					{{ result.quarter ? `${result.quarter} assignments` : 'Assignments' }}
				</h2>
				<p class="mt-1 text-sm text-ink-gray-5">
					Reported alongside the exam. These do not count toward the total above.
				</p>
			</div>

			<DataTable
				:columns="assignmentColumns"
				:rows="result.assignments"
				:row-key="assignmentKey"
				:row-height="60"
				empty="No assignments in this quarter."
			>
				<template #cell-assignment="{ row }">
					<RowTitle
						:title="row.assignment_title || row.assignment"
						:to="assignmentRoute(row.assignment)"
					>
						<template v-if="row.due_date">Due {{ formatDate(row.due_date) }}</template>
					</RowTitle>
				</template>

				<template #cell-score="{ row }">
					{{ assignmentScoreLabel(row) }}
				</template>

				<template #cell-submitted="{ row }">
					<Badge
						:label="row.is_submitted ? 'Submitted' : 'Not submitted'"
						:theme="row.is_submitted ? 'green' : 'gray'"
						variant="subtle"
					/>
				</template>
			</DataTable>
		</section>

		<section v-if="result.remarks" class="space-y-2">
			<h2 class="text-base-medium text-ink-gray-8">Remarks</h2>
			<MarkdownText :content="result.remarks" />
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { formatDate } from '@/lib/dates'
import { assignmentScoreLabel, formatMarks, formatPercent, passTheme } from '@/lib/results'
import type {
	CS17Result,
	CS17ResultAssignmentScore,
	CS17ResultSubjectPart,
	CS17ResultSubjectScore,
} from '@/types'

type SubjectRow =
	| ({ kind: 'subject'; key: string } & CS17ResultSubjectScore)
	| {
			kind: 'part'
			key: string
			label: string
			nested: boolean
			marks_obtained: number
			max_marks: number
	  }

const props = defineProps<{
	result: CS17Result
	assignmentRoute: (assignment: string) => string
}>()

/** Cohort and quarter, the two labels that place an exam, on one line. */
const metaLine = computed(() =>
	[props.result.quarter, props.result.cohort].filter(Boolean).join(' · '),
)

const subjectColumns: Column[] = [
	{ header: 'Subject', key: 'subject', variant: 'primary' },
	{ header: 'Marks', key: 'marks', width: '8rem' },
	{ header: 'Percentage', key: 'percentage', width: '5.5rem', optional: true },
	{ header: 'Grade', key: 'grade', width: '6rem', optional: true },
	{ header: 'Result', key: 'is_pass', width: '4.5rem', optional: true },
]

const assignmentColumns: Column[] = [
	{ header: 'Assignment', key: 'assignment', variant: 'primary' },
	{ header: 'Score', key: 'score', width: '9rem' },
	{ header: 'Submitted', key: 'submitted', width: '9rem' },
]

const subjectRows = computed(() =>
	props.result.scores.flatMap((score): SubjectRow[] => [
		{ ...score, kind: 'subject', key: score.subject },
		...partRows(score),
	]),
)

function partRows(score: CS17ResultSubjectScore): SubjectRow[] {
	if (score.parts.length < 2) return []
	const rows: SubjectRow[] = []
	for (const part of score.parts) {
		const key = `${score.subject}:part:${part.component}`
		if (!part.section) {
			rows.push(partRow(key, part.component, false, [part]))
			continue
		}
		const sectionKey = `${score.subject}:section:${part.section}`
		if (rows.some((row) => row.key === sectionKey)) continue
		const inSection = score.parts.filter((each) => each.section === part.section)
		rows.push(partRow(sectionKey, part.section, false, inSection))
		for (const each of inSection)
			rows.push(
				partRow(`${score.subject}:part:${each.component}`, each.component, true, [each]),
			)
	}
	return rows
}

function partRow(
	key: string,
	label: string,
	nested: boolean,
	parts: CS17ResultSubjectPart[],
): SubjectRow {
	return {
		kind: 'part',
		key,
		label,
		nested,
		marks_obtained: parts.reduce((sum, part) => sum + part.marks_obtained, 0),
		max_marks: parts.reduce((sum, part) => sum + part.max_marks, 0),
	}
}

const subjectKey = (row: SubjectRow) => row.key
const assignmentKey = (row: CS17ResultAssignmentScore) => row.assignment
</script>
