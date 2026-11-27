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
			<div v-if="view === 'day'" class="w-full max-w-xs">
				<DatePicker
					label="Date"
					:model-value="pickedDate || activity.data?.date"
					:clearable="false"
					@update:model-value="pickedDate = $event"
				/>
			</div>
			<div v-else class="flex items-center gap-1 self-end">
				<Button
					variant="ghost"
					icon="lucide-chevron-left"
					aria-label="Previous week"
					tooltip="Previous week"
					@click="moveWeek(-1)"
				/>
				<Button
					variant="ghost"
					icon="lucide-chevron-right"
					aria-label="Next week"
					tooltip="Next week"
					:disabled="isThisWeek"
					@click="moveWeek(1)"
				/>
				<span class="px-1 text-base font-medium text-ink-gray-8">{{ weekLabel }}</span>
				<Button v-if="!isThisWeek" label="This week" @click="pickedDate = today" />
			</div>
			<TabButtons v-model="view" aria-label="View" class="self-end" :options="VIEWS" />
		</div>

		<KeepAlive>
			<ActivityWeek v-if="view === 'week'" :cohort="cohort" :date="pickedDate" />
		</KeepAlive>

		<LoadError
			v-if="view === 'day' && failed"
			title="Could not load the activity"
			:loading="cohortsCall.loading || activity.loading"
			@retry="retry"
		/>

		<DataTable
			v-else-if="view === 'day'"
			v-model:selection="selection"
			:columns="columns"
			:rows="rows"
			:row-key="(row: StudentActivity) => row.student"
			:loading="loading"
			:on-row-click="(row: StudentActivity) => (openStudent = row)"
			selectable
			empty="No students in this cohort."
		>
			<template #cell-full_name="{ row }">
				<div class="flex min-w-0 items-center gap-2">
					<button
						type="button"
						class="min-w-0 rounded-1 text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
						@click.stop="openStudent = row"
					>
						<RowTitle :title="row.full_name" />
					</button>
					<Badge v-if="!row.opened" label="No work" theme="red" variant="subtle" />
				</div>
			</template>

			<template #cell-last_active_at="{ row }">
				<span v-if="!row.last_active_at" class="text-ink-gray-4">—</span>
				<template v-else>{{ parseDatetime(row.last_active_at).format('h:mm A') }}</template>
			</template>
		</DataTable>

		<div v-if="view === 'day' && selection.length" class="flex justify-center">
			<div
				class="fixed bottom-20 z-10 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-4 border border-outline-gray-1 bg-surface-base py-2 pl-4 pr-2 text-base shadow-2xl md:bottom-6"
				role="region"
				aria-label="Selected students"
			>
				<p class="whitespace-nowrap text-ink-gray-8">{{ selection.length }} selected</p>

				<div class="h-5 border-l border-outline-gray-2" />

				<Button
					label="Send reminder"
					icon-left="lucide-bell"
					:loading="reminder.loading"
					@click="sendReminder"
				/>

				<Button
					variant="ghost"
					icon="lucide-x"
					aria-label="Clear selection"
					tooltip="Clear selection"
					@click="selection = []"
				/>
			</div>
		</div>
	</PageBody>

	<StudentActivityDialog
		:open="Boolean(openStudent)"
		:student="openStudent"
		:date="activity.data?.date ?? ''"
		@update:open="openStudent = null"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Badge, Button, DatePicker, Select, TabButtons, useCall } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageBody from '@/components/common/PageBody.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import ActivityWeek from '@/components/reports/ActivityWeek.vue'
import StudentActivityDialog from '@/components/reports/StudentActivityDialog.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useCohorts } from '@/composables/useCohorts'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { useSession } from '@/composables/useSession'
import { dayjs, parseDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { toast } from '@/lib/toast'
import { trySubmit } from '@/lib/trySubmit'
import type { ClassActivity, StudentActivity } from '@/types'

const columns: Column[] = [
	{ header: 'Student', key: 'full_name', variant: 'primary' },
	{ header: 'Opened', key: 'opened', width: '5rem' },
	{ header: 'Typed in', key: 'typed', width: '5rem' },
	{ header: 'Ran', key: 'ran', width: '4rem' },
	{ header: 'Submitted', key: 'submitted', width: '6rem' },
	{ header: 'Last active', key: 'last_active_at', width: '6.5rem' },
]

const VIEWS = [
	{ label: 'Day', value: 'day' },
	{ label: 'Week', value: 'week' },
]

const view = ref('day')
const { cohort: sessionCohort } = useSession()
const pickedCohort = ref('')
const pickedDate = ref('')
const openStudent = ref<StudentActivity | null>(null)
const selection = ref<string[]>([])

const cohortsCall = useCohorts()

const cohorts = computed(() => cohortsCall.data ?? [])
const cohort = computed(() => pickedCohort.value || sessionCohort.value || cohorts.value[0] || '')

const cohortOptions = computed(() => cohorts.value.map((name) => ({ label: name, value: name })))

const activity = useCall<ClassActivity, { cohort: string; date?: string }>({
	url: '/api/v2/method/cs17_portal.class_activity.get_class_activity',
	method: 'GET',
	params: () => ({
		cohort: cohort.value,
		...(pickedDate.value ? { date: pickedDate.value } : {}),
	}),
	immediate: Boolean(cohort.value),
	refetch: true,
})

const activityOnDate = computed(() =>
	!pickedDate.value || activity.data?.date === pickedDate.value ? activity.data : null,
)
const rows = computed(() => activityOnDate.value?.students ?? [])
const loading = computed(
	() => !activityOnDate.value && (!cohortsCall.data || Boolean(cohort.value)),
)

const today = dayjs().format('YYYY-MM-DD')
const weekStart = computed(() => dayjs(pickedDate.value || today).startOf('week'))
const isThisWeek = computed(() => weekStart.value.isSame(dayjs(today).startOf('week'), 'day'))
const weekLabel = computed(() => {
	const start = weekStart.value
	const end = start.add(6, 'day')
	const startFormat =
		start.year() !== end.year() ? 'D MMM YYYY' : start.month() !== end.month() ? 'D MMM' : 'D'
	return `${start.format(startFormat)} to ${end.format('D MMM YYYY')}`
})

function moveWeek(weeks: number) {
	pickedDate.value = dayjs(pickedDate.value || today)
		.add(weeks, 'week')
		.format('YYYY-MM-DD')
}

watch(cohort, () => (selection.value = []))

watch(rows, () => {
	const students = new Set(rows.value.map((row) => row.student))
	selection.value = selection.value.filter((student) => students.has(student))
})

const reminder = useCall<null, { cohort: string; students: string[] }>({
	url: '/api/v2/method/cs17_portal.class_activity.remind_students',
	method: 'POST',
	immediate: false,
})

async function sendReminder() {
	const count = selection.value.length
	await trySubmit(reminder, { cohort: cohort.value, students: selection.value })
	if (reminder.error) {
		toast.error(frappeErrorMessage(reminder.error, 'Could not send the reminder.'))
		return
	}
	toast.success(`Reminder sent to ${count} ${count === 1 ? 'student' : 'students'}`)
	selection.value = []
}

const cohortsFailed = useLoadFailed(cohortsCall)
const activityFailed = useLoadFailed(activity)
const failed = computed(() => cohortsFailed.value || activityFailed.value)

function retry() {
	if (cohortsFailed.value) cohortsCall.reload()
	else activity.reload()
}
</script>
