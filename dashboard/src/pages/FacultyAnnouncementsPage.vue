<template>
	<AppHeader title="Announcements">
		<template #actions>
			<Button
				variant="solid"
				theme="gray"
				icon-left="lucide-plus"
				label="New announcement"
				@click="openNew"
			/>
		</template>
	</AppHeader>

	<div class="px-3 py-5 pb-10 sm:px-5">
		<p class="mb-4 text-sm text-ink-gray-5">{{ subtitle }}</p>

		<DataTable
			:columns="columns"
			:rows="announcements"
			:row-key="(row: CS17Announcement) => row.name"
			:loading="listCall.loading && !listCall.data"
			empty="No announcements yet."
		>
			<template #cell-title="{ row }">
				<span class="truncate text-ink-gray-8">{{ row.title }}</span>
			</template>

			<template #cell-cohort="{ row }">
				<span class="truncate text-ink-gray-7">{{ row.cohort || 'All cohorts' }}</span>
			</template>

			<template #cell-alert_variant="{ row }">
				<span class="inline-flex items-center gap-2 text-ink-gray-7">
					<span
						class="size-2 shrink-0 rounded-full"
						:class="variantDot(row.alert_variant)"
						aria-hidden="true"
					/>
					{{ variantLabel(row.alert_variant) }}
				</span>
			</template>

			<template #cell-status="{ row }">
				<Badge
					:label="publishStatus(row)"
					:theme="publishStatusTheme(publishStatus(row))"
					variant="subtle"
				/>
			</template>

			<template #cell-published="{ row }">
				<span class="text-ink-gray-6">{{ publishedAt(row) }}</span>
			</template>

			<template #cell-actions="{ row }">
				<div class="flex items-center justify-end gap-1">
					<Button
						icon="lucide-eye"
						:aria-label="`Preview ${row.title}`"
						@click.stop="previewTarget = row"
					/>
					<template v-if="!row.is_published">
						<Button
							icon="lucide-pencil"
							:aria-label="`Edit ${row.title}`"
							@click.stop="openEdit(row)"
						/>
						<Button
							variant="outline"
							label="Publish"
							@click.stop="publishTarget = row"
						/>
					</template>
					<Button
						icon="lucide-trash-2"
						:aria-label="`Delete ${row.title}`"
						@click.stop="deleteTarget = row"
					/>
				</div>
			</template>
		</DataTable>
	</div>

	<AnnouncementFormDialog
		:open="formOpen"
		:announcement="editTarget"
		:cohorts="cohorts"
		@update:open="onFormOpen"
		@saved="onSaved"
	/>

	<PublishAnnouncementDialog
		:open="Boolean(publishTarget)"
		:announcement="publishTarget"
		@update:open="(open: boolean) => open || (publishTarget = null)"
		@published="onPublished"
	/>

	<DeleteAnnouncementDialog
		:open="Boolean(deleteTarget)"
		:announcement="deleteTarget"
		@update:open="(open: boolean) => open || (deleteTarget = null)"
		@deleted="listCall.reload()"
	/>

	<PreviewAnnouncementDialog
		:open="Boolean(previewTarget)"
		:announcement="previewTarget"
		@update:open="(open: boolean) => open || (previewTarget = null)"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge, Button, toast, useCall, useList } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import AnnouncementFormDialog from '@/components/faculty/AnnouncementFormDialog.vue'
import DeleteAnnouncementDialog from '@/components/faculty/DeleteAnnouncementDialog.vue'
import PreviewAnnouncementDialog from '@/components/faculty/PreviewAnnouncementDialog.vue'
import PublishAnnouncementDialog from '@/components/faculty/PublishAnnouncementDialog.vue'
import { formatDate, formatDateTime } from '@/lib/dates'
import type { AlertVariant, CS17Announcement } from '@/types'

/** Where an announcement sits on the draft → scheduled → published ladder. */
type PublishStatus = 'Draft' | 'Scheduled' | 'Published'

const columns: Column[] = [
	{ header: 'Title', key: 'title', variant: 'primary' },
	{ header: 'Cohort', key: 'cohort', width: '9rem' },
	{ header: 'Variant', key: 'alert_variant', width: '8rem' },
	{ header: 'Status', key: 'status', width: '8rem' },
	{ header: 'Published', key: 'published', width: '10rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '13rem', align: 'right' },
]

const listCall = useCall<CS17Announcement[]>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_announcements',
})

const announcements = computed(() => listCall.data ?? [])

const subtitle = computed(() => {
	const count = announcements.value.length
	return `${count} ${count === 1 ? 'announcement' : 'announcements'}`
})

const cohortList = useList<{ name: string }>({
	doctype: 'CS17 Cohort',
	fields: ['name'],
	orderBy: 'name asc',
	limit: 100,
})

const cohorts = computed(() => (cohortList.data ?? []).map((cohort) => cohort.name))

const formOpen = ref(false)
const editTarget = ref<CS17Announcement | null>(null)
const publishTarget = ref<CS17Announcement | null>(null)
const deleteTarget = ref<CS17Announcement | null>(null)
const previewTarget = ref<CS17Announcement | null>(null)

function openNew() {
	editTarget.value = null
	formOpen.value = true
}

function openEdit(announcement: CS17Announcement) {
	editTarget.value = announcement
	formOpen.value = true
}

function onFormOpen(open: boolean) {
	formOpen.value = open
	// Clearing on close, not on open: `openEdit` sets the target first.
	if (!open) editTarget.value = null
}

function onSaved() {
	toast.success(editTarget.value ? 'Announcement updated' : 'Announcement created')
	listCall.reload()
}

function onPublished() {
	toast.success('Announcement published')
	listCall.reload()
}

/**
 * Published wins over a leftover `publish_on`: the backend clears the schedule
 * when it publishes, but a row written before that did not.
 */
function publishStatus(announcement: CS17Announcement): PublishStatus {
	if (announcement.is_published) return 'Published'
	return announcement.publish_on ? 'Scheduled' : 'Draft'
}

/** The same ladder the faculty assignments table uses, so the two agree. */
function publishStatusTheme(status: PublishStatus): 'gray' | 'green' | 'amber' {
	if (status === 'Published') return 'green'
	return status === 'Scheduled' ? 'amber' : 'gray'
}

/** The date column carries whichever date the status implies. */
function publishedAt(announcement: CS17Announcement): string {
	if (announcement.is_published) return formatDate(announcement.published_date) || '—'
	return announcement.publish_on ? formatDateTime(announcement.publish_on) : '—'
}

const VARIANT_DOTS: Record<AlertVariant, string> = {
	info: 'bg-surface-blue-7',
	warning: 'bg-surface-amber-7',
	error: 'bg-surface-red-7',
}

function variantDot(variant: string): string {
	return VARIANT_DOTS[variant as AlertVariant] ?? VARIANT_DOTS.info
}

function variantLabel(variant: string): string {
	return variant ? variant[0].toUpperCase() + variant.slice(1) : 'Info'
}
</script>
