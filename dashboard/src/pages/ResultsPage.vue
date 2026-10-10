<template>
	<AppHeader title="Results" />

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load your results"
			@retry="resultsCall.reload()"
		/>

		<EmptyState
			v-else-if="!loading && !results.length"
			icon="lucide-award"
			title="No results yet"
			description="Your report card appears here once an exam result is published."
		/>

		<DataTable
			v-else
			:columns="columns"
			:rows="results"
			:row-key="rowKey"
			:loading="loading"
			:row-height="60"
			:on-row-click="openResult"
			empty="No results yet."
		>
			<template #cell-exam="{ row }">
				<RowTitle :title="row.exam_name" :to="`/results/${row.name}`">
					<span v-if="row.quarter">{{ row.quarter }} · </span>
					Published {{ formatDate(row.published_on) }}
				</RowTitle>
			</template>

			<template #cell-marks="{ row }">
				{{ formatMarks(row.total_marks_obtained, row.total_max_marks) }}
			</template>

			<template #cell-percentage="{ row }">
				{{ formatPercent(row.percentage) }}
			</template>

			<template #cell-grade="{ row }">
				<span class="text-base text-ink-gray-8">{{ row.overall_grade || '—' }}</span>
			</template>

			<template #cell-status="{ row }">
				<Badge
					v-if="row.result_status"
					:label="row.result_status"
					:theme="passTheme(row.result_status === 'Pass')"
					variant="subtle"
				/>
			</template>
		</DataTable>
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { usePolling } from '@/composables/usePolling'
import { formatDate } from '@/lib/dates'
import { formatMarks, formatPercent, passTheme } from '@/lib/results'
import type { CS17ResultSummary } from '@/types'

const router = useRouter()

const resultsCall = useCall<CS17ResultSummary[]>({
	url: '/api/v2/method/cs17_portal.api.get_student_results',
})

// A result goes live when the scheduler flips `is_published`, not on a
// timestamp the client can read, so this polls rather than setting a timer the
// way the assignment and grade lists do.
usePolling(resultsCall.reload)

const results = computed(() => resultsCall.data ?? [])
const loading = computed(() => resultsCall.loading && !resultsCall.data)
const failed = computed(() => Boolean(resultsCall.error) && !resultsCall.data)

const columns: Column[] = [
	{ header: 'Exam', key: 'exam', variant: 'primary' },
	{ header: 'Marks', key: 'marks', width: '8rem' },
	{ header: 'Percentage', key: 'percentage', width: '7rem' },
	{ header: 'Grade', key: 'grade', width: '6rem' },
	{ header: 'Status', key: 'status', width: '6rem' },
]

const rowKey = (row: CS17ResultSummary) => row.name

function openResult(row: CS17ResultSummary) {
	router.push(`/results/${row.name}`)
}
</script>
