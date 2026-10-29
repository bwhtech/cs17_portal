<template>
	<AppHeader title="Results" />

	<PageBody class="space-y-5">
		<div v-if="cohorts.length > 1 || exams.length > 1" class="flex flex-wrap gap-3">
			<div v-if="cohorts.length > 1" class="w-full max-w-xs">
				<Select
					label="Cohort"
					:model-value="cohortFilter"
					:options="cohortFilterOptions"
					@update:model-value="cohortFilter = String($event)"
				/>
			</div>
			<div v-if="exams.length > 1" class="w-full max-w-xs">
				<Select
					label="Exam"
					:model-value="examFilter"
					:options="examFilterOptions"
					@update:model-value="examFilter = String($event)"
				/>
			</div>
		</div>

		<LoadError
			v-if="failed"
			title="Could not load results"
			:loading="resultsCall.loading"
			@retry="resultsCall.reload()"
		/>

		<DataTable
			v-else
			:columns="columns"
			:rows="rows"
			:row-key="rowKey"
			:loading="resultsCall.loading && !resultsCall.data"
			:row-height="60"
			:on-row-click="openResult"
			empty="No results yet."
		>
			<template #cell-student="{ row }">
				<RowTitle
					:title="row.student_name || row.student"
					:to="`/faculty/results/${row.name}`"
				>
					{{ resultTitle(row) }}
					<span v-if="spansCohorts"> · {{ row.cohort }}</span>
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

			<template #cell-result="{ row }">
				<Badge
					v-if="row.result_status"
					:label="row.result_status"
					:theme="passTheme(row.result_status === 'Pass')"
					variant="subtle"
				/>
			</template>

			<template #cell-status="{ row }">
				<Badge v-bind="publishStatus(row)" variant="subtle" />
			</template>
		</DataTable>
	</PageBody>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Select, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatMarks, formatPercent, passTheme, publishStatus, resultTitle } from '@/lib/results'
import type { FacultyResultSummary } from '@/types'

const ALL = 'all'

const router = useRouter()

const columns: Column[] = [
	{ header: 'Student', key: 'student', variant: 'primary' },
	{ header: 'Marks', key: 'marks', width: '8rem' },
	{ header: 'Percentage', key: 'percentage', width: '5.5rem' },
	{ header: 'Grade', key: 'grade', width: '6rem' },
	{ header: 'Result', key: 'result', width: '4.5rem' },
	{ header: 'Status', key: 'status', width: '7.5rem' },
]

const cohortFilter = ref(ALL)
const examFilter = ref(ALL)
watch(cohortFilter, () => {
	examFilter.value = ALL
})

const cohortsCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_cohorts',
	method: 'GET',
})

const resultsCall = useCall<FacultyResultSummary[], { cohort?: string }>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_results',
	method: 'GET',
	params: () => (cohortFilter.value === ALL ? {} : { cohort: cohortFilter.value }),
	refetch: true,
})

const failed = useLoadFailed(resultsCall)

const cohorts = computed(() => cohortsCall.data ?? [])
const results = computed(() => resultsCall.data ?? [])
const spansCohorts = computed(() => cohortFilter.value === ALL && cohorts.value.length > 1)

const cohortFilterOptions = computed(() => [
	{ label: 'All cohorts', value: ALL },
	...cohorts.value.map((cohort) => ({ label: cohort, value: cohort })),
])

const exams = computed(() => {
	const labels = new Map<string, string>()
	for (const row of results.value) {
		labels.set(
			row.exam,
			spansCohorts.value ? `${row.exam_name} · ${row.cohort}` : row.exam_name,
		)
	}
	return [...labels].map(([value, label]) => ({ label, value }))
})

const examFilterOptions = computed(() => [{ label: 'All exams', value: ALL }, ...exams.value])

const rows = computed(() =>
	examFilter.value === ALL
		? results.value
		: results.value.filter((row) => row.exam === examFilter.value),
)

const rowKey = (row: FacultyResultSummary) => row.name

function openResult(row: FacultyResultSummary) {
	router.push(`/faculty/results/${row.name}`)
}
</script>
