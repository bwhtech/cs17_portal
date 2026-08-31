<template>
	<AppHeader title="Assignment">
		<template #left-mobile>
			<PageHeaderBackButton to="/faculty/assignments" />
		</template>
	</AppHeader>

	<div class="px-3 py-5 pb-10 sm:px-5">
		<PageSkeleton v-if="detail.loading && !detail.data" />

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
					<h1 class="mb-4 text-2xl text-ink-gray-9">{{ assignment.title }}</h1>
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
					Submissions ({{ submissions.length }})
				</h2>

				<BulkAssignBar
					v-if="selection.length"
					:submissions="selection"
					@done="clearSelection"
				/>

				<DataTable
					v-model:selection="selection"
					:columns="columns"
					:rows="submissions"
					:row-key="(row: CS17Submission) => row.name"
					selectable
					empty="No submissions yet."
				>
					<template #cell-student="{ row }">
						<span class="truncate text-ink-gray-8">{{
							row.full_name ?? row.student
						}}</span>
					</template>

					<template #cell-submitted="{ row }">
						<span class="text-ink-gray-6">{{ formatDateTime(row.submitted_at) }}</span>
					</template>

					<template #cell-grade="{ row }">
						<span v-if="!isGraded" class="text-ink-gray-5">—</span>
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
						<div class="flex flex-wrap items-center gap-2 md:justify-end">
							<Button variant="ghost" label="Preview" @click="previewTarget = row" />
							<Button
								variant="ghost"
								:label="assigneesOf(row).length ? 'Assigned' : 'Assign'"
								@click="assignTargetName = row.name"
							/>
							<Button
								v-if="isGraded"
								variant="outline"
								:label="row.grade ? 'Edit grade' : 'Grade'"
								@click="gradeTarget = row"
							/>
						</div>
					</template>
				</DataTable>
			</section>
		</div>
	</div>

	<SubmissionPreviewDialog
		v-if="previewTarget"
		:open="Boolean(previewTarget)"
		:title="`Submission: ${previewTarget.full_name ?? previewTarget.student}`"
		:submission-type="assignment?.submission_type"
		:submission="previewTarget.name"
		:file-url="previewTarget.submission_document || previewTarget.submission_url"
		@update:open="previewTarget = null"
	/>

	<AssignSubmissionDialog
		v-if="assignTarget"
		:open="Boolean(assignTarget)"
		:submission="assignTarget"
		@update:open="assignTargetName = null"
		@success="detail.reload()"
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
import { Badge, Button, PageHeaderBackButton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import SubmissionPreviewDialog from '@/components/assignments/SubmissionPreviewDialog.vue'
import AssignSubmissionDialog, {
	type AssignTarget,
} from '@/components/faculty/AssignSubmissionDialog.vue'
import BulkAssignBar from '@/components/faculty/BulkAssignBar.vue'
import GradeSubmissionDialog from '@/components/faculty/GradeSubmissionDialog.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { formatDateTime } from '@/lib/dates'
import type { CS17Assignment, CS17Grade, CS17Submission } from '@/types'

const route = useRoute()
const breadcrumbs = useBreadcrumbs()

const assignmentId = computed(() => String(route.params.assignmentId ?? ''))

const detail = useCall<
	{ assignment: CS17Assignment; submissions: CS17Submission[] },
	{ assignment: string }
>({
	url: '/api/v2/method/cs17_portal.api.get_assignment_submissions',
	params: () => ({ assignment: assignmentId.value }),
	refetch: true,
})

const assignment = computed(() => detail.data?.assignment ?? null)
const submissions = computed(() => detail.data?.submissions ?? [])

const selection = ref<string[]>([])
const previewTarget = ref<CS17Submission | null>(null)
const gradeTarget = ref<CS17Submission | null>(null)
/**
 * The assign dialog is addressed by name, not by row: it reloads the list after
 * every assign, and the chips have to follow the fresh `_assign`.
 */
const assignTargetName = ref<string | null>(null)

const isGraded = computed(() => assignment.value?.assignment_type === 'Graded')
const isGradeScale = computed(() => isGraded.value && assignment.value?.remarks === 'Grade')

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
	{ header: 'Submitted', key: 'submitted', width: '11rem' },
	{ header: 'Grade', key: 'grade', width: '11rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '16rem', align: 'right' },
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

const assignTarget = computed<AssignTarget | null>(() => {
	const row = submissions.value.find((s) => s.name === assignTargetName.value)
	if (!row) return null
	return { name: row.name, fullName: row.full_name, assignedTo: assigneesOf(row) }
})

function gradeValue(grade: CS17Grade): string {
	const value = isGradeScale.value ? grade.grade : grade.marks_obtained
	return value === null || value === undefined ? '—' : String(value)
}

function clearSelection() {
	selection.value = []
	detail.reload()
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
