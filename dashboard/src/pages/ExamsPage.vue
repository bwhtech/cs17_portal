<template>
	<AppHeader title="Exams" />

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load your exams"
			:loading="examsCall.loading"
			@retry="examsCall.reload()"
		/>

		<EmptyState
			v-else-if="!loading && !exams.length"
			icon="lucide-timer"
			title="No exams yet"
		/>

		<DataTable
			v-else
			:columns="columns"
			:rows="exams"
			:row-key="rowKey"
			:loading="loading"
			:row-height="60"
			:on-row-click="openExam"
			empty="No exams yet."
		>
			<template #cell-exam="{ row }">
				<RowTitle :title="row.title" :to="`/exams/${row.name}`">
					{{ formatDuration(row.duration_minutes) }}
				</RowTitle>
			</template>

			<template #cell-opens="{ row }">{{ formatDateTime(row.opens_on) }}</template>

			<template #cell-closes="{ row }">{{ formatDateTime(row.closes_on) }}</template>

			<template #cell-state="{ row }">
				<Badge
					:label="EXAM_STATES[row.state].label"
					:theme="EXAM_STATES[row.state].theme"
				/>
			</template>
		</DataTable>
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Badge } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageBody from '@/components/common/PageBody.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { EXAM_STATES, formatDuration, type CodingExamSummary } from '@/components/exams/codingExam'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolledCall, usePolling } from '@/composables/usePolling'
import { formatDateTime } from '@/lib/dates'

const router = useRouter()

const examsCall = usePolledCall<CodingExamSummary[]>({
	url: '/api/v2/method/cs17_portal.coding_exam.get_my_coding_exams',
})
usePolling(examsCall.reload)

const exams = computed(() => examsCall.data ?? [])
const loading = computed(() => examsCall.loading && !examsCall.data)
const failed = useLoadFailed(examsCall)

const columns: Column[] = [
	{ header: 'Exam', key: 'exam', variant: 'primary' },
	{ header: 'Opens', key: 'opens', width: '10rem' },
	{ header: 'Closes', key: 'closes', width: '10rem' },
	{ header: 'State', key: 'state', width: '6.5rem' },
]

const rowKey = (row: CodingExamSummary) => row.name

function openExam(row: CodingExamSummary) {
	router.push(`/exams/${row.name}`)
}
</script>
