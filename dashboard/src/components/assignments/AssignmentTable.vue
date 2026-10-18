<template>
	<DataTable
		:columns="columns"
		:rows="assignments"
		:row-key="rowKey"
		:loading="loading"
		:row-height="60"
		:empty="cohort ? 'No assignments yet.' : 'You are not in a cohort yet.'"
	>
		<template #cell-icon="{ row }">
			<SubmissionTypeIcon :submission-type="row.submission_type" />
		</template>

		<!-- Two lines per row: the title, then what to hand in and when it is
		     due — the pair a student scans for. -->
		<template #cell-title="{ row }">
			<RowTitle :title="row.title" :to="`/assignments/${row.name}/submission`">
				{{ row.submission_type ?? 'Any' }}
				<template v-if="row.due_date">
					·
					<span :class="isOverdue(row) && 'text-ink-red-6'">
						Due {{ formatDateTime(row.due_date) }}
					</span>
				</template>
			</RowTitle>
		</template>

		<template #cell-status="{ row }">
			<Badge
				:label="statusOf(row)"
				:theme="assignmentStatusTheme(statusOf(row))"
				variant="subtle"
			/>
		</template>

		<template #cell-submitted="{ row }">
			<div class="min-w-0 leading-tight">
				<div class="truncate text-base font-normal text-ink-gray-7">
					{{ formatDateTime(submissionMap[row.name]?.submitted_at) || 'Not submitted' }}
				</div>
				<div
					v-if="gradeLine(row)"
					class="mt-1.5 truncate text-sm font-normal text-ink-gray-5"
				>
					{{ gradeLine(row) }}
				</div>
			</div>
		</template>

		<template #cell-actions="{ row }">
			<div class="flex items-center justify-end gap-2">
				<Button
					v-if="submissionMap[row.name]"
					label="Preview"
					@click="openPreview(row, submissionMap[row.name])"
				/>
				<Button v-if="row.has_answers" label="Answers" @click="openAnswers(row)" />
				<Button
					v-if="showsGrade(row)"
					label="View Grade"
					@click="emit('view-grade', row.name)"
				/>
				<Button
					v-else-if="
						statusOf(row) === 'Submitted' && !isProjectSubmission(row.submission_type)
					"
					label="Edit"
					@click="openSubmit(row, submissionMap[row.name])"
				/>
				<Button
					v-else-if="row.next_attempt"
					variant="solid"
					theme="gray"
					label="Reattempt"
					@click="python.reattempt(row)"
				/>
				<Button
					v-else-if="statusOf(row) === 'Pending'"
					variant="solid"
					theme="gray"
					:label="isProjectSubmission(row.submission_type) ? 'Start' : 'Submit'"
					@click="openSubmit(row, null)"
				/>
			</div>
		</template>
	</DataTable>

	<SubmitAssignmentDialog
		v-if="submitAssignment"
		v-model:open="submitOpen"
		:assignment="submitAssignment"
		:existing-submission="submitSubmission"
		@success="onSubmitted"
	/>

	<AnswersDialog
		v-if="answers.data"
		v-model:open="answersOpen"
		:title="`Answers: ${answersTitle}`"
		:answers="answers.data.answers"
		:summary="answers.data.summary"
		:note="answers.data.note"
	/>

	<SubmissionPreviewDialog
		v-if="previewAssignment"
		v-model:open="previewOpen"
		:title="`Your Submission: ${previewAssignment.title}`"
		:submission-type="previewAssignment.submission_type"
		:file-url="previewSubmission?.submission_document || previewSubmission?.submission_url"
		:submission="previewSubmission?.name"
	/>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { Badge, Button, toast, useCall } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import SubmissionTypeIcon from '@/components/common/SubmissionTypeIcon.vue'
import SubmitAssignmentDialog from '@/components/assignments/SubmitAssignmentDialog.vue'
import { usePythonAssignment } from '@/components/assignments/pythonEditor'
import { useScratchAssignment } from '@/components/assignments/scratchEditor'
import { useSession } from '@/composables/useSession'
import { formatDateTime, isPast } from '@/lib/dates'
import { formatGrade } from '@/lib/grades'
import { assignmentStatus, assignmentStatusTheme } from '@/lib/status'
import { isProjectSubmission } from '@/lib/submissionTypes'
import { trySubmit } from '@/lib/trySubmit'
import type {
	AnswerSummary,
	CS17Assignment,
	CS17Grade,
	CS17Submission,
	StudentAnswer,
} from '@/types'

const AnswersDialog = defineAsyncComponent(() => import('@/components/answers/AnswersDialog.vue'))
const SubmissionPreviewDialog = defineAsyncComponent(
	() => import('@/components/assignments/SubmissionPreviewDialog.vue'),
)

const props = defineProps<{
	assignments: CS17Assignment[]
	/** The student's own submissions, keyed by assignment. */
	submissionMap: Record<string, CS17Submission>
	/** The grades they are allowed to see, keyed by assignment. */
	gradeMap?: Record<string, CS17Grade>
	loading?: boolean
}>()

const emit = defineEmits<{
	/** A submission was created or edited; the parent reloads its data. */
	submitted: []
	/** The student asked to see the grade for this assignment. */
	'view-grade': [assignment: string]
}>()

const columns: Column[] = [
	{ header: '', key: 'icon', variant: 'avatar', width: '2.75rem' },
	{ header: 'Assignment', key: 'title', variant: 'primary' },
	{ header: 'Status', key: 'status', width: '6rem' },
	{ header: 'Submitted', key: 'submitted', width: '9rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '17rem', align: 'right' },
]

const rowKey = (row: CS17Assignment) => row.name

const scratch = useScratchAssignment()
const python = usePythonAssignment()
const { cohort } = useSession()

const submitOpen = ref(false)
const submitAssignment = ref<CS17Assignment | null>(null)
const submitSubmission = ref<CS17Submission | null>(null)

const previewOpen = ref(false)
const answersOpen = ref(false)
const answersTitle = ref('')

const answers = useCall<
	{ answers: StudentAnswer[]; summary: AnswerSummary[]; note: string } | null,
	{ assignment: string }
>({
	url: '/api/v2/method/cs17_portal.answer_sheet.get_my_answers',
	immediate: false,
})

async function openAnswers(assignment: CS17Assignment) {
	answersTitle.value = assignment.title
	await trySubmit(answers, { assignment: assignment.name })
	if (answers.error || !answers.data) {
		toast.error('Could not load your answers.')
		return
	}
	answersOpen.value = true
}
const previewAssignment = ref<CS17Assignment | null>(null)
const previewSubmission = ref<CS17Submission | null>(null)

/** The ladder is imported, never re-derived — three surfaces have to agree. */
function statusOf(assignment: CS17Assignment) {
	return assignmentStatus(
		assignment,
		props.submissionMap[assignment.name],
		props.gradeMap?.[assignment.name],
	)
}

function isOverdue(assignment: CS17Assignment): boolean {
	return statusOf(assignment) !== 'Submitted' && isPast(assignment.due_date)
}

/** The second line of the Submitted cell, once a grade is theirs to see. */
function gradeLine(assignment: CS17Assignment): string {
	if (!showsGrade(assignment)) return ''
	const grade = props.gradeMap?.[assignment.name]
	if (!grade) return ''
	if (grade.evaluation_type !== 'Marks') return grade.grade ? `Grade ${grade.grade}` : ''
	return formatGrade({
		evaluationType: 'Marks',
		grade: grade.grade,
		marksObtained: grade.marks_obtained,
		maxMarks: assignment.max_marks,
	})
}

function isScratch(assignment: CS17Assignment): boolean {
	return assignment.submission_type === 'Scratch'
}

/** A Not Graded assignment closes without a grade, so it offers nothing to view. */
function showsGrade(assignment: CS17Assignment): boolean {
	return (
		statusOf(assignment) === 'Closed' &&
		Boolean(props.gradeMap?.[assignment.name]) &&
		assignment.assignment_type !== 'Not Graded'
	)
}

function openSubmit(assignment: CS17Assignment, existing: CS17Submission | null) {
	if (isScratch(assignment)) {
		scratch.open(assignment, existing)
		return
	}
	if (assignment.submission_type === 'Python') {
		python.open(assignment)
		return
	}
	submitAssignment.value = assignment
	submitSubmission.value = existing
	submitOpen.value = true
}

function openPreview(assignment: CS17Assignment, submission: CS17Submission) {
	if (isScratch(assignment)) {
		// A closed Scratch assignment opens in the player rather than the editor.
		scratch.open(assignment, submission, {
			readOnly: statusOf(assignment) === 'Closed',
		})
		return
	}
	if (assignment.submission_type === 'Python') {
		python.open(assignment, { readOnly: statusOf(assignment) === 'Closed' })
		return
	}
	previewAssignment.value = assignment
	previewSubmission.value = submission
	previewOpen.value = true
}

function onSubmitted() {
	submitOpen.value = false
	emit('submitted')
}
</script>
