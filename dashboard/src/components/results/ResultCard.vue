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
				:rows="result.scores"
				:row-key="subjectKey"
				empty="No subjects on this result."
			>
				<template #cell-subject="{ row }">
					<RowTitle :title="row.subject_name || row.subject" />
				</template>

				<template #cell-marks="{ row }">
					{{ formatMarks(row.marks_obtained, row.max_marks) }}
				</template>

				<template #cell-percentage="{ row }">
					{{ formatPercent(row.percentage) }}
				</template>

				<template #cell-grade="{ row }">
					<span class="text-base text-ink-gray-8">{{ row.grade || '—' }}</span>
				</template>

				<template #cell-outcome="{ row }">
					<Badge
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
						Due {{ formatDate(row.due_date) }}
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
			<p class="text-p-base whitespace-pre-line break-words text-ink-gray-7">
				{{ result.remarks }}
			</p>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { formatDate } from '@/lib/dates'
import { assignmentScoreLabel, formatMarks, formatPercent, passTheme } from '@/lib/results'
import type { CS17Result, CS17ResultAssignmentScore, CS17ResultSubjectScore } from '@/types'

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
	{ header: 'Percentage', key: 'percentage', width: '5.5rem' },
	{ header: 'Grade', key: 'grade', width: '6rem' },
	{ header: 'Result', key: 'outcome', width: '4.5rem' },
]

const assignmentColumns: Column[] = [
	{ header: 'Assignment', key: 'assignment', variant: 'primary' },
	{ header: 'Score', key: 'score', width: '9rem' },
	{ header: 'Submitted', key: 'submitted', width: '9rem' },
]

const subjectKey = (row: CS17ResultSubjectScore) => row.subject
const assignmentKey = (row: CS17ResultAssignmentScore) => row.assignment
</script>
