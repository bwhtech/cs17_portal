<template>
	<AppHeader title="Assignments">
		<template #actions>
			<Button
				variant="solid"
				theme="gray"
				:icon-left="isDesktop ? 'lucide-plus' : undefined"
				:icon="isDesktop ? undefined : 'lucide-plus'"
				label="New Assignment"
				@click="openNew"
			/>
		</template>
	</AppHeader>

	<PageBody class="space-y-5">
		<div v-if="drafts.length">
			<Button
				:label="`Drafts (${drafts.length})`"
				:icon-right="draftsOpen ? 'lucide-chevron-up' : 'lucide-chevron-down'"
				:aria-expanded="draftsOpen"
				@click="draftsOpen = !draftsOpen"
			/>
			<div v-if="draftsOpen" class="mt-3 flex flex-wrap gap-2">
				<Button
					v-for="draft in drafts"
					:key="draft.name"
					class="max-w-full"
					:label="draft.title || 'Untitled'"
					@click="openDraft(draft.name)"
				/>
			</div>
		</div>

		<div v-if="cohorts.length > 1" class="max-w-xs">
			<Select
				label="Cohort"
				:model-value="cohortFilter"
				:options="cohortFilterOptions"
				@update:model-value="cohortFilter = String($event)"
			/>
		</div>

		<LoadError
			v-if="failed"
			title="Could not load assignments"
			:loading="assignmentsCall.loading"
			@retry="assignmentsCall.reload()"
		/>

		<DataTable
			v-else
			v-model:selection="selection"
			:columns="columns"
			:rows="rows"
			:row-key="(row: AssignmentRow) => row.name"
			:loading="assignmentsCall.loading && !assignmentsCall.data"
			:row-height="60"
			v-model:collapsed-groups="collapsedTopics"
			:group-by="(row: AssignmentRow) => row.topic || NO_TOPIC"
			:on-row-drop="moveToTopic"
			selectable
			empty="No assignments yet."
		>
			<template #cell-icon="{ row }">
				<SubmissionTypeIcon :submission-type="row.submission_type" />
			</template>

			<!-- Same two-line row as the student list: title over the
				     cohort, what is expected, and when it is due. -->
			<template #cell-title="{ row }">
				<div class="flex min-w-0 items-start gap-2">
					<RowTitle :title="row.title" :to="`/faculty/assignments/${row.name}`">
						<template v-if="row.due_date">
							Due {{ formatDateTime(row.due_date) }} ·
						</template>
						{{ row.submission_type ?? 'Any' }} · {{ row.cohort }}
					</RowTitle>
					<DifficultyBadge
						v-if="row.difficulty"
						class="shrink-0"
						:difficulty="row.difficulty"
					/>
					<Badge
						v-if="row.student_count"
						class="shrink-0"
						:label="`${row.student_count} ${row.student_count === 1 ? 'student' : 'students'}`"
						theme="blue"
						variant="subtle"
					/>
				</div>
			</template>

			<template #cell-submission_count="{ row }">
				<span class="text-base text-ink-gray-7">
					{{ (row.submission_count ?? 0).toLocaleString() }}
				</span>
			</template>

			<template #cell-status="{ row }">
				<div class="min-w-0 leading-tight">
					<Badge :label="row.statusLabel" :theme="row.statusTheme" variant="subtle" />
					<div
						v-if="row.scheduledAt"
						class="mt-1.5 text-balance text-sm leading-tight text-ink-gray-5"
					>
						{{ row.scheduledAt }}
					</div>
				</div>
			</template>

			<template #cell-actions="{ row }">
				<div class="flex items-center justify-end gap-2">
					<Button
						v-if="row.statusLabel !== 'Published'"
						variant="ghost"
						icon="lucide-pencil"
						:aria-label="`Edit ${row.title}`"
						tooltip="Edit"
						@click="openDraft(row.name, row.statusLabel === 'Scheduled')"
					/>
					<Button
						v-if="!row.is_published"
						:label="row.publish_on ? 'Reschedule' : 'Publish'"
						@click="publishTarget = row"
					/>
					<Button
						variant="ghost"
						icon="lucide-trash-2"
						class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
						:aria-label="`Delete ${row.title}`"
						tooltip="Delete"
						@click="deleteTarget = row"
					/>
				</div>
			</template>
		</DataTable>

		<AssignmentBulkActions
			v-if="selection.length"
			:assignments="selection"
			:has-submissions="selectionHasSubmissions"
			:cohorts="cohorts"
			:quarters="quarters"
			@done="onBulkDone"
			@clear="selection = []"
		/>
	</PageBody>

	<AssignmentFormDialog
		:key="formKey"
		v-model:open="formOpen"
		:cohorts="cohorts"
		:quarters="quarters"
		:draft-name="editingDraft"
		:scheduled="editingScheduled"
		@saved="assignmentsCall.reload()"
	/>

	<PublishAssignmentDialog
		:open="Boolean(publishTarget)"
		:assignment="publishTarget"
		@update:open="onPublishOpen"
		@success="onPublished"
	/>

	<DeleteAssignmentDialog
		:open="Boolean(deleteTarget)"
		:assignment="deleteTarget"
		@update:open="onDeleteOpen"
		@success="assignmentsCall.reload()"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Badge, Button, Select, useCall } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import SubmissionTypeIcon from '@/components/common/SubmissionTypeIcon.vue'
import AssignmentBulkActions from '@/components/faculty/AssignmentBulkActions.vue'
import AssignmentFormDialog from '@/components/faculty/AssignmentFormDialog.vue'
import DeleteAssignmentDialog from '@/components/faculty/DeleteAssignmentDialog.vue'
import DifficultyBadge from '@/components/faculty/DifficultyBadge.vue'
import PublishAssignmentDialog from '@/components/faculty/PublishAssignmentDialog.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatDateTime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage'
import { toast } from '@/lib/toast'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Assignment } from '@/types'

/** A row plus the badge ladder, resolved once instead of three times in the cell. */
interface AssignmentRow extends CS17Assignment {
	statusLabel: 'Published' | 'Scheduled' | 'Draft'
	statusTheme: 'green' | 'amber' | 'gray'
	/** The scheduled publish time, shown under the Scheduled badge. */
	scheduledAt: string
}

const ALL_COHORTS = 'all'
const NO_TOPIC = 'No topic'

const columns: Column[] = [
	{ header: '', key: 'icon', variant: 'avatar', width: '2.75rem' },
	{ header: 'Assignment', key: 'title', variant: 'primary' },
	{ header: 'Submissions', key: 'submission_count', width: '6rem' },
	{ header: 'Status', key: 'status', width: '7.5rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '10.5rem', align: 'right' },
]

const cohortFilter = ref(ALL_COHORTS)
const draftsOpen = ref(false)
const formOpen = ref(false)
const formKey = ref(0)
const editingDraft = ref<string | null>(null)
const editingScheduled = ref(false)
const publishTarget = ref<AssignmentRow | null>(null)
const deleteTarget = ref<AssignmentRow | null>(null)
const selection = ref<string[]>([])
const collapsedTopics = ref(readJSON<string[]>(STORAGE_KEYS.collapsedTopics, []))
watch(collapsedTopics, (value) => writeJSON(STORAGE_KEYS.collapsedTopics, value))

const cohortsCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_cohorts',
	method: 'GET',
})

const quartersCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_quarters',
	method: 'GET',
})

const assignmentsCall = useCall<CS17Assignment[], { cohort?: string }>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_assignments',
	method: 'GET',
	params: () => (cohortFilter.value === ALL_COHORTS ? {} : { cohort: cohortFilter.value }),
	refetch: true,
})

const failed = useLoadFailed(assignmentsCall)

const moveCall = useCall<null, { assignments: string[]; topic: string }>({
	url: '/api/v2/method/cs17_portal.api.move_assignments_to_topic',
	method: 'POST',
	immediate: false,
})

const cohorts = computed(() => cohortsCall.data ?? [])

const quarters = computed(() => quartersCall.data ?? [])

const cohortFilterOptions = computed(() => [
	{ label: 'All cohorts', value: ALL_COHORTS },
	...cohorts.value.map((cohort) => ({ label: cohort, value: cohort })),
])

const movedTopics = ref<Record<string, string>>({})

const rows = computed<AssignmentRow[]>(() =>
	(assignmentsCall.data ?? []).map((assignment) => ({
		...assignment,
		topic: movedTopics.value[assignment.name] ?? assignment.topic,
		...status(assignment),
	})),
)

const selectionHasSubmissions = computed(() =>
	rows.value.some((row) => selection.value.includes(row.name) && !!row.submission_count),
)

watch(rows, () => {
	const names = new Set(rows.value.map((row) => row.name))
	selection.value = selection.value.filter((name) => names.has(name))
})

/** Neither published nor scheduled — the rows the Drafts row offers to reopen. */
const drafts = computed(() => rows.value.filter((row) => row.statusLabel === 'Draft'))

function onPublishOpen(open: boolean) {
	if (!open) publishTarget.value = null
}

function onPublished() {
	// The form keeps the last assignment it opened; a new schedule makes that copy stale.
	if (publishTarget.value?.name === editingDraft.value) formKey.value += 1
	assignmentsCall.reload()
}

function onDeleteOpen(open: boolean) {
	if (!open) deleteTarget.value = null
}

function onBulkDone() {
	selection.value = []
	assignmentsCall.reload()
}

async function moveToTopic(moved: AssignmentRow[], group: string) {
	const topic = group === NO_TOPIC ? '' : group
	const previous = Object.fromEntries(moved.map((row) => [row.name, row.topic || '']))
	const error = await saveTopics(Object.fromEntries(moved.map((row) => [row.name, topic])))
	if (error) return toast.error(`Could not move to ${group}`, { description: error })
	toast.success(topic ? `Moved to ${topic}` : 'Topic removed', {
		description: moved.length === 1 ? moved[0].title : `${moved.length} assignments`,
		action: { label: 'Undo', onClick: () => undoMove(previous) },
	})
}

async function undoMove(previous: Record<string, string>) {
	const error = await saveTopics(previous)
	if (error) toast.error('Could not undo the move', { description: error })
}

async function saveTopics(topics: Record<string, string>): Promise<string> {
	const namesByTopic = new Map<string, string[]>()
	for (const [name, topic] of Object.entries(topics)) {
		namesByTopic.set(topic, [...(namesByTopic.get(topic) ?? []), name])
	}
	Object.assign(movedTopics.value, topics)
	let error = ''
	for (const [topic, assignments] of namesByTopic) {
		await trySubmit(moveCall, { assignments, topic })
		if (moveCall.error && !error)
			error = frappeErrorMessage(moveCall.error, 'Nothing was moved.')
	}
	await assignmentsCall.reload()
	for (const name of Object.keys(topics)) delete movedTopics.value[name]
	return error
}

function status(assignment: CS17Assignment) {
	if (assignment.is_published) {
		return { statusLabel: 'Published', statusTheme: 'green', scheduledAt: '' } as const
	}
	if (assignment.publish_on) {
		return {
			statusLabel: 'Scheduled',
			statusTheme: 'amber',
			scheduledAt: formatDateTime(assignment.publish_on),
		} as const
	}
	return { statusLabel: 'Draft', statusTheme: 'gray', scheduledAt: '' } as const
}

function openNew() {
	editingDraft.value = null
	editingScheduled.value = false
	formOpen.value = true
}

function openDraft(name: string, scheduled = false) {
	editingDraft.value = name
	editingScheduled.value = scheduled
	formOpen.value = true
}

const { isDesktop } = useBreakpoint()
</script>
