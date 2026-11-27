<template>
	<LoadError
		v-if="failed"
		title="Could not load the week"
		:loading="week.loading"
		@retry="week.reload()"
	/>

	<div v-else-if="!week.data || showsOtherWeek" class="cs17-delay-in space-y-2">
		<Skeleton v-for="n in 4" :key="n" class="h-8 w-full rounded-2" />
	</div>

	<EmptyState v-else-if="!week.data.students.length" title="No students in this cohort." />

	<div v-else class="space-y-3">
		<div class="overflow-x-auto">
			<div
				role="table"
				aria-label="Activity this week"
				class="grid min-w-max grid-cols-[minmax(10rem,1fr)_repeat(7,3rem)] gap-1"
			>
				<div role="row" class="contents">
					<span role="columnheader"><span class="sr-only">Student</span></span>
					<span
						v-for="day in week.data.days"
						:key="day"
						role="columnheader"
						class="text-center text-sm text-ink-gray-5"
					>
						{{ dayjs(day).format('ddd D') }}
					</span>
				</div>

				<div
					v-for="row in week.data.students"
					:key="row.student"
					role="row"
					class="contents"
				>
					<div
						role="rowheader"
						class="sticky left-0 flex min-w-0 items-center bg-surface-base pr-2"
					>
						<RowTitle :title="row.full_name" />
					</div>
					<span
						v-for="(day, index) in row.days"
						:key="index"
						role="cell"
						class="flex h-8 rounded-2 text-sm"
						:class="LEVELS[level(day)].class"
						:title="describe(week.data.days[index], day)"
						:aria-label="day.opened ? undefined : describe(week.data.days[index], day)"
					>
						<button
							v-if="day.opened"
							type="button"
							class="size-full rounded-2 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
							:aria-label="describe(week.data.days[index], day)"
							@click="openDay(row, week.data.days[index])"
						>
							{{ day.opened }}
						</button>
					</span>
				</div>
			</div>
		</div>

		<ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-gray-5">
			<li v-for="item in LEVELS" :key="item.label" class="flex items-center gap-1.5">
				<span class="size-3 rounded-1" :class="item.class" />
				{{ item.label }}
			</li>
		</ul>
	</div>

	<StudentActivityDialog
		:open="Boolean(openStudent)"
		:student="openStudent"
		:date="openDate"
		@update:open="openStudent = null"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Skeleton, useCall } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import StudentActivityDialog from '@/components/reports/StudentActivityDialog.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { dayjs } from '@/lib/dates'

interface DayActivity {
	opened: number
	worked: number
	submitted: number
}

interface ClassActivityWeek {
	date: string
	days: string[]
	students: { student: string; full_name: string; days: DayActivity[] }[]
}

const props = defineProps<{ cohort: string; date?: string }>()

const LEVELS = [
	{ label: 'No work', class: 'bg-surface-gray-2' },
	{ label: 'Opened', class: 'bg-surface-green-2 text-ink-green-8' },
	{ label: 'Typed or ran', class: 'bg-surface-green-3 text-ink-green-8' },
	{ label: 'Submitted', class: 'bg-surface-green-5 text-ink-green-9' },
]

const week = useCall<ClassActivityWeek, { cohort: string; date?: string }>({
	url: '/api/v2/method/cs17_portal.activity_week.get_class_activity_week',
	method: 'GET',
	params: () => ({ cohort: props.cohort, ...(props.date ? { date: props.date } : {}) }),
	refetch: true,
})

const showsOtherWeek = computed(() => !!props.date && !week.data?.days.includes(props.date))

const failed = useLoadFailed(week)

type WeekStudent = ClassActivityWeek['students'][number]

const openStudent = ref<WeekStudent | null>(null)
const openDate = ref('')

function openDay(student: WeekStudent, date: string) {
	openDate.value = date
	openStudent.value = student
}

function level(day: DayActivity) {
	return day.submitted ? 3 : day.worked ? 2 : day.opened ? 1 : 0
}

function describe(date: string, day: DayActivity) {
	const label = dayjs(date).format('ddd D MMM')
	if (!day.opened) return `${label}: no work`
	return `${label}: ${day.opened} opened, ${day.worked} typed or ran, ${day.submitted} submitted`
}
</script>
