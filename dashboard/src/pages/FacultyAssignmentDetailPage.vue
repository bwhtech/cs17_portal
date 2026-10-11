<template>
	<AppHeader title="Assignment">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/faculty/assignments" />
		</template>
		<template #actions>
			<Button
				v-if="assignment"
				:variant="isDesktop ? 'subtle' : 'ghost'"
				:icon-left="isDesktop ? 'lucide-link' : undefined"
				:icon="isDesktop ? undefined : 'lucide-link'"
				:tooltip="isDesktop ? undefined : 'Copy submission link'"
				label="Copy submission link"
				@click="copySubmissionLink"
			/>
		</template>
	</AppHeader>

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load this assignment"
			:loading="detail.loading"
			@retry="detail.reload()"
		/>

		<PageSkeleton v-else-if="detail.loading && !detail.data" />

		<EmptyState
			v-else-if="!assignment"
			icon="lucide-file-question"
			title="Assignment not found"
			description="It may have been deleted."
		>
			<template #action>
				<Button label="Back to assignments" route="/faculty/assignments" />
			</template>
		</EmptyState>

		<div v-else class="space-y-6">
			<div class="flex flex-col gap-6 md:flex-row">
				<div class="min-w-0 flex-1">
					<MarkdownText :content="assignment.description" />
				</div>

				<div class="w-full shrink-0 md:w-64">
					<dl
						class="space-y-3 rounded-4 border border-outline-gray-1 bg-surface-base p-4"
					>
						<div v-for="meta in metaRows" :key="meta.label">
							<dt class="text-xs text-ink-gray-5">{{ meta.label }}</dt>
							<dd class="text-base font-medium text-ink-gray-8">
								{{ meta.value }}
							</dd>
						</div>
					</dl>
				</div>
			</div>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">
					Submissions ({{ submissions.length }} of {{ rows.length }})
				</h2>

				<DataTable
					v-model:selection="selection"
					:columns="columns"
					:rows="rows"
					:row-key="(row: CS17Submission) => row.name"
					:is-row-selectable="isSubmitted"
					selectable
					empty="No submissions yet."
				>
					<template #cell-student="{ row }">
						<span class="truncate text-ink-gray-8">{{
							row.full_name ?? row.student
						}}</span>
					</template>

					<template #cell-status="{ row }">
						<Badge
							:label="isSubmitted(row) ? 'Submitted' : 'Not submitted'"
							:theme="isSubmitted(row) ? 'green' : 'gray'"
							variant="subtle"
						/>
					</template>

					<template #cell-submitted="{ row }">
						<span v-if="isSubmitted(row)" class="text-ink-gray-6">{{
							formatDateTime(row.submitted_at)
						}}</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-assignees="{ row }">
						<div v-if="isSubmitted(row)" @click.stop>
							<SubmissionAssignees
								:submission="row.name"
								:assigned-to="assigneesOf(row)"
								:cohort="assignment.cohort"
								@changed="detail.reload()"
							/>
						</div>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-grade="{ row }">
						<span v-if="!isSubmitted(row) || !isGraded" class="text-ink-gray-5">—</span>
						<Badge
							v-else-if="!row.grade"
							label="Ungraded"
							theme="gray"
							variant="subtle"
						/>
						<span v-else class="flex items-center gap-2">
							<span class="text-base font-medium text-ink-gray-8">{{
								gradeValue(row.grade)
							}}</span>
							<Badge
								:label="row.grade.is_published ? 'Published' : 'Draft'"
								:theme="row.grade.is_published ? 'green' : 'amber'"
								variant="subtle"
							/>
						</span>
					</template>

					<template #cell-actions="{ row }">
						<div
							v-if="isSubmitted(row)"
							class="flex flex-wrap items-center gap-2 md:justify-end"
						>
							<Button label="Preview" @click="previewTarget = row" />
							<Button
								v-if="isGraded"
								:label="row.grade ? 'Edit grade' : 'Grade'"
								@click="gradeTarget = row"
							/>
						</div>
					</template>
				</DataTable>

				<BulkAssignBar
					v-if="selection.length"
					:submissions="selection"
					:cohort="assignment.cohort"
					@done="clearSelection"
					@clear="selection = []"
				/>
			</section>
		</div>
	</PageBody>

	<SubmissionPreviewDialog
		v-if="previewTarget"
		:open="Boolean(previewTarget)"
		:title="`Submission: ${previewTarget.full_name ?? previewTarget.student}`"
		:submission-type="assignment?.submission_type"
		:submission="previewTarget.name"
		:file-url="previewTarget.submission_document || previewTarget.submission_url"
		@update:open="previewTarget = null"
	/>

	<GradeSubmissionDialog
		v-if="gradeTarget"
		:open="Boolean(gradeTarget)"
		:submission="gradeTarget"
		:evaluation-type="assignment?.remarks ?? 'Marks'"
		:max-marks="assignment?.max_marks"
		@update:open="gradeTarget = null"
		@success="detail.reload()"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Badge, Button, PageHeaderBackButton, toast, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import SubmissionPreviewDialog from '@/components/assignments/SubmissionPreviewDialog.vue'
import BulkAssignBar from '@/components/faculty/BulkAssignBar.vue'
import GradeSubmissionDialog from '@/components/faculty/GradeSubmissionDialog.vue'
import SubmissionAssignees from '@/components/faculty/SubmissionAssignees.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatDateTime } from '@/lib/dates'
import { isRefusal } from '@/lib/frappeError'
import { formatGrade } from '@/lib/grades'
import type { CS17Assignment, CS17Grade, CS17Student, CS17Submission } from '@/types'

const route = useRoute()
const breadcrumbs = useBreadcrumbs()
const { isDesktop } = useBreakpoint()

const assignmentId = computed(() => String(route.params.assignmentId ?? ''))

const detail = useCall<
	{ assignment: CS17Assignment; submissions: CS17Submission[]; not_submitted: CS17Student[] },
	{ assignment: string }
>({
	url: '/api/v2/method/cs17_portal.api.get_assignment_submissions',
	params: () => ({ assignment: assignmentId.value }),
	refetch: true,
})

const assignment = computed(() => detail.data?.assignment ?? null)
const failed = useLoadFailed(detail, { except: isRefusal })
const submissions = computed(() => detail.data?.submissions ?? [])

/** Every student of the cohort: those who submitted first, then a bare row for each who has not. */
const rows = computed<CS17Submission[]>(() => [
	...submissions.value,
	...(detail.data?.not_submitted ?? []).map((student) => ({
		name: student.student,
		student: student.student,
		full_name: student.full_name,
		assignment: assignmentId.value,
		submitted_at: '',
	})),
])

function isSubmitted(row: CS17Submission): boolean {
	return Boolean(row.submitted_at)
}

const selection = ref<string[]>([])
const previewTarget = ref<CS17Submission | null>(null)
const gradeTarget = ref<CS17Submission | null>(null)

const isGraded = computed(() => assignment.value?.assignment_type === 'Graded')

const metaRows = computed(() => {
	const rows = [
		{ label: 'Due', value: formatDateTime(assignment.value?.due_date) },
		{ label: 'Cohort', value: assignment.value?.cohort ?? '—' },
		{
			label: 'Evaluation Type',
			value: isGraded.value ? (assignment.value?.remarks ?? '—') : 'Non-graded',
		},
	]
	if (isGraded.value && assignment.value?.remarks === 'Marks') {
		rows.push({ label: 'Max Marks', value: String(assignment.value?.max_marks ?? '—') })
	}
	return rows
})

const columns: Column[] = [
	{ header: 'Student', key: 'student', variant: 'primary' },
	{ header: 'Status', key: 'status', width: '7.5rem' },
	{ header: 'Submitted', key: 'submitted', width: '9rem' },
	{ header: 'Assigned to', key: 'assignees', width: '9rem' },
	{ header: 'Grade', key: 'grade', width: '10rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '11rem', align: 'right' },
]

/** `_assign` is Frappe's ToDo mirror: a JSON array of user ids, or nothing. */
function assigneesOf(submission: CS17Submission): string[] {
	if (!submission._assign) return []
	try {
		const parsed = JSON.parse(submission._assign)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

function gradeValue(grade: CS17Grade): string {
	return formatGrade({
		evaluationType: assignment.value?.remarks,
		grade: grade.grade,
		marksObtained: grade.marks_obtained,
		maxMarks: assignment.value?.max_marks,
	})
}

function clearSelection() {
	selection.value = []
	detail.reload()
}

async function copySubmissionLink() {
	const url = `${window.location.origin}/dashboard/assignments/${assignmentId.value}/submission`
	try {
		await navigator.clipboard.writeText(url)
		toast.success('Submission link copied.')
	} catch {
		toast.error('Could not copy link.')
	}
}

watch(
	() => assignment.value?.title,
	(title) => {
		if (!title) return
		breadcrumbs.set([{ label: 'Assignments', route: '/faculty/assignments' }, { label: title }])
	},
	{ immediate: true },
)
</script>
