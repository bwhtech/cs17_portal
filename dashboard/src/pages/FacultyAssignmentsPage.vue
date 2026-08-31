<template>
	<AppHeader title="Assignments">
		<template #actions>
			<Button
				variant="solid"
				theme="gray"
				icon-left="lucide-plus"
				label="New Assignment"
				@click="openNew"
			/>
		</template>
	</AppHeader>

	<div class="space-y-5 px-3 py-5 pb-10 sm:px-5">
		<div>
			<h1 class="text-2xl font-semibold text-ink-gray-9">Assignments</h1>
			<p class="mt-1 text-p-base text-ink-gray-5">{{ rows.length }} total</p>
		</div>

		<!-- Drafts are invisible to students, so they sit above the table as a
		     collapsed row rather than competing with published work in it. -->
		<div v-if="drafts.length">
			<Button
				:label="`Drafts (${drafts.length})`"
				:icon-right="draftsOpen ? 'lucide-chevron-up' : 'lucide-chevron-down'"
				:aria-expanded="draftsOpen"
				@click="draftsOpen = !draftsOpen"
			/>
			<div v-if="draftsOpen" class="mt-3 flex flex-wrap gap-2">
				<button
					v-for="draft in drafts"
					:key="draft.name"
					type="button"
					class="rounded-4 border border-outline-gray-2 px-3 py-1.5 text-base text-ink-gray-7 hover:bg-surface-gray-2"
					@click="openDraft(draft.name)"
				>
					{{ draft.title || 'Untitled' }}
				</button>
			</div>
		</div>

		<div class="max-w-xs">
			<Select
				label="Cohort"
				:model-value="cohortFilter"
				:options="cohortFilterOptions"
				@update:model-value="cohortFilter = String($event)"
			/>
		</div>

		<div class="md:rounded-4 md:border md:border-outline-gray-1 md:bg-surface-base md:p-5">
			<DataTable
				:columns="columns"
				:rows="rows"
				:row-key="(row: AssignmentRow) => row.name"
				:loading="assignmentsCall.loading && !assignmentsCall.data"
				empty="No assignments yet."
			>
				<template #cell-title="{ row }">
					<button
						type="button"
						class="truncate text-left text-ink-gray-8 hover:underline"
						@click="router.push(`/faculty/assignments/${row.name}`)"
					>
						{{ row.title }}
					</button>
				</template>

				<template #cell-cohort="{ row }">
					<span class="text-ink-gray-6">{{ row.cohort }}</span>
				</template>

				<template #cell-submission_type="{ row }">
					<Badge :label="row.submission_type" theme="gray" variant="subtle" />
				</template>

				<template #cell-due_date="{ row }">
					<span class="text-ink-gray-6">{{ formatDateTime(row.due_date) }}</span>
				</template>

				<template #cell-submission_count="{ row }">
					<Badge
						:label="String(row.submission_count ?? 0)"
						theme="gray"
						variant="outline"
					/>
				</template>

				<template #cell-status="{ row }">
					<div class="flex flex-col items-start gap-0.5">
						<Badge :label="row.statusLabel" :theme="row.statusTheme" variant="subtle" />
						<span v-if="row.scheduledAt" class="text-xs text-ink-gray-5">
							{{ row.scheduledAt }}
						</span>
					</div>
				</template>

				<template #cell-actions="{ row }">
					<div class="flex items-center justify-end gap-2">
						<Button
							v-if="!row.is_published"
							:label="row.publish_on ? 'Reschedule' : 'Publish'"
							@click="publishTarget = row"
						/>
						<Button
							variant="ghost"
							icon="lucide-trash-2"
							:aria-label="`Delete ${row.title}`"
							@click="deleteTarget = row"
						/>
					</div>
				</template>
			</DataTable>
		</div>
	</div>

	<AssignmentFormDialog
		v-model:open="formOpen"
		:cohorts="cohorts"
		:draft-name="editingDraft"
		@saved="assignmentsCall.reload()"
	/>

	<PublishAssignmentDialog
		:open="Boolean(publishTarget)"
		:assignment="publishTarget"
		@update:open="onPublishOpen"
		@success="assignmentsCall.reload()"
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
import { useRouter } from 'vue-router'
import { Badge, Button, Select, useCall, useList } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import AssignmentFormDialog from '@/components/faculty/AssignmentFormDialog.vue'
import DeleteAssignmentDialog from '@/components/faculty/DeleteAssignmentDialog.vue'
import PublishAssignmentDialog from '@/components/faculty/PublishAssignmentDialog.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { formatDateTime } from '@/lib/dates'
import type { CS17Assignment } from '@/types'

/** A row plus the badge ladder, resolved once instead of three times in the cell. */
interface AssignmentRow extends CS17Assignment {
	statusLabel: 'Published' | 'Scheduled' | 'Draft'
	statusTheme: 'green' | 'amber' | 'gray'
	/** The scheduled publish time, shown under the Scheduled badge. */
	scheduledAt: string
}

const ALL_COHORTS = 'all'

const columns: Column[] = [
	{ header: 'Title', key: 'title', variant: 'primary' },
	{ header: 'Cohort', key: 'cohort', width: '8rem' },
	{ header: 'Type', key: 'submission_type', width: '7rem' },
	{ header: 'Due', key: 'due_date', width: '10rem' },
	{ header: 'Submissions', key: 'submission_count', width: '7rem' },
	{ header: 'Status', key: 'status', width: '9rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '12rem', align: 'right' },
]

const router = useRouter()

const cohortFilter = ref(ALL_COHORTS)
const draftsOpen = ref(false)
const formOpen = ref(false)
const editingDraft = ref<string | null>(null)
const publishTarget = ref<AssignmentRow | null>(null)
const deleteTarget = ref<AssignmentRow | null>(null)

const cohortList = useList<{ name: string }>({
	doctype: 'CS17 Cohort',
	fields: ['name'],
	orderBy: 'name asc',
	limit: 500,
})

const assignmentsCall = useCall<CS17Assignment[], { cohort?: string }>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_assignments',
	method: 'GET',
	params: () => (cohortFilter.value === ALL_COHORTS ? {} : { cohort: cohortFilter.value }),
	refetch: true,
})

const cohorts = computed(() => (cohortList.data ?? []).map((cohort) => cohort.name))

const cohortFilterOptions = computed(() => [
	{ label: 'All cohorts', value: ALL_COHORTS },
	...cohorts.value.map((cohort) => ({ label: cohort, value: cohort })),
])

const rows = computed<AssignmentRow[]>(() =>
	(assignmentsCall.data ?? []).map((assignment) => ({ ...assignment, ...status(assignment) })),
)

/** Neither published nor scheduled — the rows the Drafts row offers to reopen. */
const drafts = computed(() => rows.value.filter((row) => row.statusLabel === 'Draft'))

function onPublishOpen(open: boolean) {
	if (!open) publishTarget.value = null
}

function onDeleteOpen(open: boolean) {
	if (!open) deleteTarget.value = null
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
	formOpen.value = true
}

function openDraft(name: string) {
	editingDraft.value = name
	formOpen.value = true
}

// Reopening "New Assignment" after editing a draft must not carry the draft
// name over, and only the close path can clear it.
watch(formOpen, (open) => {
	if (!open) editingDraft.value = null
})
</script>
