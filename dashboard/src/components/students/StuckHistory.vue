<template>
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-ink-gray-8">Stuck</h2>
		<ErrorMessage v-if="failed" message="Could not load when this student was stuck." />
		<DataTable
			v-else
			:columns="columns"
			:rows="history.data ?? []"
			:row-key="(row: StuckSpell) => `${row.assignment}:${row.started_at}`"
			:group-by="(row: StuckSpell) => row.topic || 'No topic'"
			:loading="history.loading && !history.data"
			:row-height="60"
			empty="Not stuck in the last 30 days."
		>
			<template #cell-title="{ row }">
				<RowTitle :title="row.title" :to="`/faculty/assignments/${row.assignment}`">
					{{ formatDateTime(row.started_at) }}
				</RowTitle>
			</template>
			<template #cell-minutes="{ row }">{{ formatMinutes(row.minutes) }}</template>
			<template #cell-error="{ row }">
				<span :class="row.error_type ? 'font-mono' : 'text-ink-gray-5'">
					{{ errorAt(row) }}
				</span>
			</template>
			<template #cell-status="{ row }">
				<Badge
					:label="row.got_past ? 'Got past' : 'Stuck'"
					:theme="row.got_past ? 'green' : 'amber'"
				/>
			</template>
		</DataTable>
	</section>
</template>

<script setup lang="ts">
import { Badge, ErrorMessage, useCall } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatDateTime } from '@/lib/dates'

interface StuckSpell {
	assignment: string
	title: string
	topic: string | null
	started_at: string
	minutes: number
	error_type: string | null
	error_line: number | null
	got_past: boolean
}

const props = defineProps<{ studentId: string }>()

const history = useCall<StuckSpell[], { student: string }>({
	url: '/api/v2/method/cs17_portal.stuck_history.get_student_stuck_history',
	params: () => ({ student: props.studentId }),
	refetch: true,
})
const failed = useLoadFailed(history)

const columns: Column[] = [
	{ header: 'Assignment', key: 'title', variant: 'primary' },
	{ header: 'How long', key: 'minutes', width: '6rem' },
	{ header: 'Error most seen', key: 'error', width: '12rem' },
	{ header: 'Status', key: 'status', width: '6rem' },
]

function formatMinutes(minutes: number): string {
	return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

function errorAt(row: StuckSpell): string {
	if (!row.error_type) return 'Tests failing'
	return row.error_line ? `${row.error_type} on line ${row.error_line}` : row.error_type
}
</script>
