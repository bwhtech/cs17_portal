<template>
	<AppHeader title="Activity" />

	<PageBody class="space-y-5">
		<div class="flex flex-wrap gap-3">
			<div v-if="cohorts.length > 1" class="w-full max-w-xs">
				<Select
					label="Cohort"
					:model-value="cohort"
					:options="cohortOptions"
					@update:model-value="pickedCohort = String($event)"
				/>
			</div>
			<div class="w-full max-w-xs">
				<DatePicker
					label="Date"
					:model-value="pickedDate || activity.data?.date"
					:clearable="false"
					@update:model-value="pickedDate = $event"
				/>
			</div>
		</div>

		<LoadError
			v-if="failed"
			title="Could not load the activity"
			:loading="cohortsCall.loading || activity.loading"
			@retry="retry"
		/>

		<DataTable
			v-else
			:columns="columns"
			:rows="rows"
			:row-key="(row: StudentActivity) => row.student"
			:loading="loading"
			:on-row-click="(row: StudentActivity) => (openStudent = row)"
			empty="No students in this cohort."
		>
			<template #cell-full_name="{ row }">
				<div class="flex min-w-0 items-center gap-2">
					<RowTitle :title="row.full_name" />
					<Badge v-if="!row.opened" label="No work" theme="red" variant="subtle" />
				</div>
			</template>

			<template #cell-last_active_at="{ row }">
				<span v-if="!row.last_active_at" class="text-ink-gray-4">—</span>
				<template v-else>{{ parseDatetime(row.last_active_at).format('h:mm A') }}</template>
			</template>
		</DataTable>
	</PageBody>

	<StudentActivityDialog
		:open="Boolean(openStudent)"
		:student="openStudent"
		@update:open="openStudent = null"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge, DatePicker, Select, useCall } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageBody from '@/components/common/PageBody.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import StudentActivityDialog from '@/components/reports/StudentActivityDialog.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { parseDatetime } from '@/lib/dates'
import type { ClassActivity, StudentActivity } from '@/types'

const columns: Column[] = [
	{ header: 'Student', key: 'full_name', variant: 'primary' },
	{ header: 'Opened', key: 'opened', width: '5rem' },
	{ header: 'Typed in', key: 'typed', width: '5rem' },
	{ header: 'Ran', key: 'ran', width: '4rem' },
	{ header: 'Submitted', key: 'submitted', width: '6rem' },
	{ header: 'Last active', key: 'last_active_at', width: '6.5rem' },
]

const pickedCohort = ref('')
const pickedDate = ref('')
const openStudent = ref<StudentActivity | null>(null)

const cohortsCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_cohorts',
	method: 'GET',
})

const cohorts = computed(() => cohortsCall.data ?? [])
const cohort = computed(() => pickedCohort.value || cohorts.value[0] || '')

const cohortOptions = computed(() => cohorts.value.map((name) => ({ label: name, value: name })))

const activity = useCall<ClassActivity, { cohort: string; date?: string }>({
	url: '/api/v2/method/cs17_portal.class_activity.get_class_activity',
	method: 'GET',
	params: () => ({
		cohort: cohort.value,
		...(pickedDate.value ? { date: pickedDate.value } : {}),
	}),
	immediate: false,
	refetch: true,
})

const rows = computed(() => activity.data?.students ?? [])
const loading = computed(() => !activity.data && (!cohortsCall.data || Boolean(cohort.value)))

const cohortsFailed = useLoadFailed(cohortsCall)
const activityFailed = useLoadFailed(activity)
const failed = computed(() => cohortsFailed.value || activityFailed.value)

function retry() {
	if (cohortsFailed.value) cohortsCall.reload()
	else activity.reload()
}
</script>
