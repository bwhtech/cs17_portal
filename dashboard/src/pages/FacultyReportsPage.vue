<template>
	<AppHeader title="Reports">
		<template #actions>
			<Dropdown v-if="rows.length" :options="downloadOptions" align="end">
				<Button
					:icon-left="isDesktop ? 'lucide-download' : undefined"
					:icon="isDesktop ? undefined : 'lucide-download'"
					:tooltip="isDesktop ? undefined : 'Download'"
					label="Download"
				/>
			</Dropdown>
		</template>
	</AppHeader>

	<PageBody class="space-y-5">
		<p class="text-sm text-ink-gray-5">Average counts published marks only.</p>

		<div v-if="cohorts.length > 1 || quarters.length" class="flex flex-wrap gap-3">
			<div v-if="cohorts.length > 1" class="w-full max-w-xs">
				<Select
					label="Cohort"
					:model-value="cohort"
					:options="cohortOptions"
					@update:model-value="pickedCohort = String($event)"
				/>
			</div>
			<div v-if="quarters.length" class="w-full max-w-xs">
				<Select
					label="Quarter"
					:model-value="quarter"
					:options="quarterOptions"
					@update:model-value="quarter = String($event ?? '')"
				/>
			</div>
		</div>

		<LoadError
			v-if="failed"
			title="Could not load the report"
			:loading="cohortsCall.loading || report.loading"
			@retry="retry"
		/>

		<DataTable
			v-else
			:columns="columns"
			:rows="rows"
			:row-key="(row: ClassReportRow) => row.student"
			:loading="loading"
			empty="No students in this cohort."
		>
			<template #cell-full_name="{ row }">
				<RowTitle :title="row.full_name" />
			</template>

			<template #cell-missing="{ row }">
				<span :class="{ 'text-ink-red-6': row.missing }">{{ row.missing }}</span>
			</template>

			<template #cell-average="{ row }">
				<span v-if="row.average === null" class="text-ink-gray-4">—</span>
				<template v-else>{{ formatPercent(row.average) }}</template>
			</template>

			<template #cell-grade="{ row }">
				<span v-if="!row.grade" class="text-ink-gray-4">—</span>
				<template v-else>{{ row.grade }}</template>
			</template>
		</DataTable>

		<TopicProgress :topics="topicProgress.data" :failed="topicProgressFailed" class="space-y-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">By topic</h2>
		</TopicProgress>
	</PageBody>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Dropdown, Select, useCall } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageBody from '@/components/common/PageBody.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import TopicProgress, { type TopicProgressRow } from '@/components/reports/TopicProgress.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatPercent } from '@/lib/results'
import type { ClassReportRow } from '@/types'

const columns: Column[] = [
	{ header: 'Student', key: 'full_name', variant: 'primary' },
	{ header: 'Given', key: 'given', width: '5rem' },
	{ header: 'Submitted', key: 'submitted', width: '6rem' },
	{ header: 'Missing', key: 'missing', width: '5rem' },
	{ header: 'Late', key: 'late', width: '4rem' },
	{ header: 'Average', key: 'average', width: '5.5rem' },
	{ header: 'Grade', key: 'grade', width: '6rem' },
]

const pickedCohort = ref('')
const quarter = ref('')

const cohortsCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_cohorts',
	method: 'GET',
})

const quartersCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_quarters',
	method: 'GET',
})

const cohorts = computed(() => cohortsCall.data ?? [])
const quarters = computed(() => quartersCall.data ?? [])
const cohort = computed(() => pickedCohort.value || cohorts.value[0] || '')

const cohortOptions = computed(() => cohorts.value.map((name) => ({ label: name, value: name })))

const quarterOptions = computed(() => [
	{ label: 'All quarters', value: '' },
	...quarters.value.map((name) => ({ label: name, value: name })),
])

const params = computed(() => ({
	cohort: cohort.value,
	...(quarter.value ? { quarter: quarter.value } : {}),
}))

const report = useCall<ClassReportRow[], { cohort: string; quarter?: string }>({
	url: '/api/v2/method/cs17_portal.api.get_class_report',
	method: 'GET',
	params: () => params.value,
	immediate: false,
	refetch: true,
})

const rows = computed(() => report.data ?? [])
const loading = computed(() => !report.data && (!cohortsCall.data || Boolean(cohort.value)))

const cohortsFailed = useLoadFailed(cohortsCall)
const reportFailed = useLoadFailed(report)
const failed = computed(() => cohortsFailed.value || reportFailed.value)

function retry() {
	if (cohortsFailed.value) cohortsCall.reload()
	else report.reload()
}

function download(method: string) {
	window.location.href = `/api/method/${method}?${new URLSearchParams(params.value)}`
}

const downloadOptions = [
	{ label: 'Summary', onClick: () => download('cs17_portal.api.download_class_report') },
	{ label: 'All marks', onClick: () => download('cs17_portal.gradebook.download_gradebook') },
]

const { isDesktop } = useBreakpoint()

const topicProgress = useCall<TopicProgressRow[], { cohort: string; quarter?: string }>({
	url: '/api/v2/method/cs17_portal.topic_progress.get_class_topic_progress',
	method: 'GET',
	params: () => params.value,
	immediate: false,
	refetch: true,
})
const topicProgressFailed = useLoadFailed(topicProgress)
</script>
