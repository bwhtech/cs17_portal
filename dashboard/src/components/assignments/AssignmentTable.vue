<template>
	<DataTable
		:columns="columns"
		:rows="assignments"
		:row-key="rowKey"
		:loading="loading"
		empty="No assignments yet."
	>
		<template #cell-title="{ row }">
			<RouterLink
				:to="`/assignments/${row.name}/submission`"
				class="truncate text-ink-gray-8 hover:underline"
			>
				{{ row.title }}
			</RouterLink>
		</template>

		<template #cell-due="{ row }">
			<span class="text-ink-gray-6">{{ formatDateTime(row.due_date) }}</span>
		</template>

		<template #cell-status="{ row }">
			<Badge
				:label="statusOf(row)"
				:theme="assignmentStatusTheme(statusOf(row))"
				variant="subtle"
			/>
		</template>

		<template #cell-submitted="{ row }">
			<span class="text-ink-gray-6">{{
				formatDateTime(submissionMap[row.name]?.submitted_at)
			}}</span>
		</template>

		<template #cell-actions="{ row }">
			<div class="flex items-center justify-end gap-2">
				<Button
					v-if="submissionMap[row.name]"
					label="Preview"
					@click="openPreview(row, submissionMap[row.name])"
				/>
				<Button
					v-if="showsGrade(row)"
					label="View Grade"
					@click="emit('view-grade', row.name)"
				/>
				<Button
					v-else-if="statusOf(row) === 'Submitted' && !isScratch(row)"
					variant="outline"
					label="Edit"
					@click="openSubmit(row, submissionMap[row.name])"
				/>
				<Button
					v-else-if="statusOf(row) === 'Pending'"
					variant="solid"
					theme="gray"
					label="Submit"
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
import { ref } from 'vue'
import { Badge, Button } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import SubmissionPreviewDialog from '@/components/assignments/SubmissionPreviewDialog.vue'
import SubmitAssignmentDialog from '@/components/assignments/SubmitAssignmentDialog.vue'
import { useScratchAssignment } from '@/components/assignments/scratchEditor'
import { formatDateTime } from '@/lib/dates'
import { assignmentStatus, assignmentStatusTheme } from '@/lib/status'
import type { CS17Assignment, CS17Grade, CS17Submission } from '@/types'

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
	{ header: 'Title', key: 'title', variant: 'primary' },
	{ header: 'Due', key: 'due', width: '11rem' },
	{ header: 'Status', key: 'status', width: '8rem' },
	{ header: 'Submitted', key: 'submitted', width: '11rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '12rem', align: 'right' },
]

const rowKey = (row: CS17Assignment) => row.name

const scratch = useScratchAssignment()

const submitOpen = ref(false)
const submitAssignment = ref<CS17Assignment | null>(null)
const submitSubmission = ref<CS17Submission | null>(null)

const previewOpen = ref(false)
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
	previewAssignment.value = assignment
	previewSubmission.value = submission
	previewOpen.value = true
}

function onSubmitted() {
	submitOpen.value = false
	emit('submitted')
}
</script>
