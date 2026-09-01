<template>
	<AppHeader title="Shared components" />

	<div class="mx-auto max-w-[940px] space-y-11 px-3 py-5 pb-10 sm:px-5">
		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">DataTable</h2>
			<p class="text-p-sm text-ink-gray-5">
				Selectable, with a primary column, two fields and an actions column. Narrow the
				window past <code>md</code> to see the card layout.
			</p>
			<DataTable
				v-model:selection="selection"
				:columns="columns"
				:rows="rows"
				:row-key="(row: Row) => row.name"
				selectable
				empty="No assignments yet."
			>
				<template #cell-title="{ row }">
					<span class="truncate text-ink-gray-8">{{ row.title }}</span>
				</template>
				<template #cell-due="{ row }">{{ formatDateTime(row.due) }}</template>
				<template #cell-status="{ row }">
					<Badge
						:label="row.status"
						:theme="assignmentStatusTheme(row.status)"
						variant="subtle"
					/>
				</template>
				<template #cell-actions>
					<Button label="Preview" />
				</template>
			</DataTable>
			<p class="text-p-sm text-ink-gray-5">Selected: {{ selection.join(', ') || 'none' }}</p>
		</section>

		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">DataTable — loading and empty</h2>
			<DataTable :columns="columns" :rows="[]" :row-key="(row: Row) => row.name" loading />
			<DataTable
				:columns="columns"
				:rows="[]"
				:row-key="(row: Row) => row.name"
				empty="Nothing due this week."
			/>
		</section>

		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">MarkdownText</h2>
			<div class="rounded-4 border border-outline-gray-1 bg-surface-base p-4">
				<MarkdownText :content="markdownSample" />
			</div>
			<div class="rounded-4 border border-outline-gray-1 bg-surface-base p-4">
				<MarkdownText content="" />
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">GradeBadge</h2>
			<div class="flex flex-wrap items-center gap-2">
				<GradeBadge :graded="false" />
				<GradeBadge graded grade="A" />
				<GradeBadge graded :marks-obtained="17" :max-marks="20" />
				<GradeBadge graded :marks-obtained="17" />
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">PublishFields</h2>
			<div class="max-w-sm">
				<PublishFields
					v-model:mode="publishMode"
					v-model:publish-on="publishOn"
					include-draft
					hint="A scheduled assignment appears to students at the chosen time."
				/>
			</div>
			<p class="text-p-sm text-ink-gray-5">
				mode: <code>{{ publishMode }}</code> · publish_on:
				<code>{{ publishOn || '—' }}</code>
			</p>
		</section>

		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">EmptyState</h2>
			<div class="rounded-4 border border-outline-gray-1">
				<EmptyState
					icon="lucide-blocks"
					title="No projects yet"
					description="Start one and it shows up here."
				>
					<template #action>
						<Button
							variant="solid"
							theme="gray"
							icon-left="lucide-plus"
							label="New project"
						/>
					</template>
				</EmptyState>
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">ScratchFrame</h2>
			<p class="text-p-sm text-ink-gray-5">
				Read-only, with no project loaded. Events: {{ frameLog.join(' · ') || 'none yet' }}
			</p>
			<div class="h-[420px] overflow-hidden rounded-4 border border-outline-gray-1">
				<ScratchFrame
					read-only
					@ready="frameLog.push('ready')"
					@dirty="frameLog.push('dirty')"
				/>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Badge, Button } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import GradeBadge from '@/components/common/GradeBadge.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import PublishFields from '@/components/common/PublishFields.vue'
import ScratchFrame from '@/components/scratch/ScratchFrame.vue'
import { formatDateTime } from '@/lib/dates'
import { assignmentStatusTheme, type AssignmentStatus } from '@/lib/status'
import type { PublishMode } from '@/types'

interface Row {
	name: string
	title: string
	due: string
	status: AssignmentStatus
}

const columns: Column[] = [
	{ header: 'Title', key: 'title', variant: 'primary' },
	{ header: 'Due', key: 'due', width: '10rem' },
	{ header: 'Status', key: 'status', width: '8rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '7rem', align: 'right' },
]

const rows: Row[] = [
	{ name: 'A-1', title: 'Build a maze game', due: '2026-09-04 17:00:00', status: 'Pending' },
	{ name: 'A-2', title: 'Sorting worksheet', due: '2026-08-28 17:00:00', status: 'Submitted' },
	{ name: 'A-3', title: 'Binary numbers quiz', due: '2026-08-14 17:00:00', status: 'Closed' },
]

const selection = ref<string[]>([])

const markdownSample = [
	'## Brief',
	'',
	'Build a maze where the sprite **cannot** pass through walls.',
	'',
	'1. Draw the maze',
	'2. Add collision detection',
	'',
	'> Submit the `.sb3` before the deadline.',
	'',
	'[The handbook](/student-handbook) has the rubric.',
].join('\n')

const publishMode = ref<PublishMode>('draft')
const publishOn = ref('')

const frameLog = ref<string[]>([])
</script>
