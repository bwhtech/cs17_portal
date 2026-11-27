<template>
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-ink-gray-8">Activity</h2>
		<ErrorMessage v-if="failed" message="Could not load activity." />
		<div v-else-if="!calendar.data" class="cs17-delay-in">
			<Skeleton class="h-36 w-full max-w-xs rounded-4" />
		</div>
		<template v-else>
			<div class="overflow-x-auto">
				<div
					class="grid w-max grid-flow-col grid-rows-7 gap-1"
					role="img"
					:aria-label="`Work per day from ${formatDate(calendar.data?.start)} to ${formatDate(calendar.data?.end)}`"
				>
					<template v-for="cell in cells" :key="cell.date">
						<div v-if="!cell.day" class="size-4" />
						<Tooltip v-else :text="describe(cell.day)">
							<div class="size-4 rounded-1" :class="shade(cell.day)" />
						</Tooltip>
					</template>
				</div>
			</div>
			<p class="text-base text-ink-gray-6">{{ summary }}</p>
		</template>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ErrorMessage, Skeleton, Tooltip, useCall } from 'frappe-ui'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { dayjs, formatDate } from '@/lib/dates'

interface ActivityDay {
	date: string
	saves: number
	runs: number
	submissions: number
}

interface ActivityCalendar {
	start: string
	end: string
	days: ActivityDay[]
}

const props = defineProps<{ student: string }>()

const calendar = useCall<ActivityCalendar, { student: string }>({
	url: '/api/v2/method/cs17_portal.activity_calendar.get_student_activity_calendar',
	params: () => ({ student: props.student }),
	refetch: true,
})
const failed = useLoadFailed(calendar)

const SHADES = [
	'bg-surface-gray-2',
	'bg-surface-green-3',
	'bg-surface-green-5',
	'bg-surface-green-7',
]

const work = (day: ActivityDay) => day.saves + day.runs + day.submissions

const byDate = computed(() => new Map(calendar.data?.days.map((day) => [day.date, day])))
const busiest = computed(() => Math.max(1, ...(calendar.data?.days ?? []).map(work)))

const cells = computed(() => {
	if (!calendar.data) return []
	const start = dayjs(calendar.data.start)
	const end = dayjs(calendar.data.end)
	const cells: { date: string; day?: ActivityDay }[] = []
	for (
		let date = start.subtract((start.day() + 6) % 7, 'day');
		!date.isAfter(end);
		date = date.add(1, 'day')
	) {
		const key = date.format('YYYY-MM-DD')
		cells.push({
			date: key,
			day: date.isBefore(start)
				? undefined
				: (byDate.value.get(key) ?? { date: key, saves: 0, runs: 0, submissions: 0 }),
		})
	}
	return cells
})

function shade(day: ActivityDay): string {
	return SHADES[Math.ceil((work(day) / busiest.value) * (SHADES.length - 1))]
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function describe(day: ActivityDay): string {
	const counts = [
		day.saves && plural(day.saves, 'save'),
		day.runs && plural(day.runs, 'run'),
		day.submissions && plural(day.submissions, 'submission'),
	].filter(Boolean)
	return `${formatDate(day.date)}: ${counts.join(', ') || 'No work'}`
}

const summary = computed(() => {
	const days = calendar.data?.days ?? []
	const last = days.at(-1)
	if (!last) return 'No work in the last 12 weeks.'
	const end = dayjs(calendar.data?.end)
	const activeSince = (count: number) =>
		days.filter((day) => !dayjs(day.date).isBefore(end.subtract(count - 1, 'day'))).length
	return `Active ${activeSince(7)} of the last 7 days · ${activeSince(30)} of the last 30 · Last active ${formatDate(last.date)}`
})
</script>
