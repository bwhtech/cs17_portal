<template>
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-ink-gray-8">Activity</h2>
		<ErrorMessage v-if="failed" message="Could not load activity." />
		<div v-else-if="!calendar.data" class="cs17-delay-in">
			<Skeleton class="h-36 w-full max-w-xs rounded-4" />
		</div>
		<template v-else>
			<div class="overflow-x-auto">
				<table
					ref="grid"
					role="grid"
					class="border-separate border-spacing-1 text-xs text-ink-gray-5"
					:aria-label="`Work per day from ${formatDate(calendar.data.start)} to ${formatDate(calendar.data.end)}`"
					@keydown="moveFocus"
				>
					<thead>
						<tr>
							<td />
							<th
								v-for="month in months"
								:key="month.key"
								:colspan="month.weeks"
								scope="colgroup"
								class="relative h-4 p-0 text-left font-normal"
							>
								<span v-if="month.weeks > 1" class="absolute left-0 top-0">
									{{ month.label }}
								</span>
							</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(row, weekday) in rows" :key="weekday">
							<th scope="row" class="p-0 pr-1 text-left font-normal">
								<span :class="{ 'sr-only': weekday % 2 }">{{
									WEEKDAYS[weekday]
								}}</span>
							</th>
							<template v-for="cell in row" :key="cell.date">
								<td v-if="!cell.day" class="size-4 p-0" />
								<Tooltip v-else :text="describe(cell.day)">
									<td
										class="size-4 rounded-1 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
										:class="shade(cell.day)"
										:data-date="cell.date"
										:tabindex="cell.date === focusedDate ? 0 : -1"
										:aria-label="describe(cell.day)"
										@focus="pickedDate = cell.date"
									/>
								</Tooltip>
							</template>
						</tr>
					</tbody>
				</table>
			</div>
			<p class="text-base text-ink-gray-6">{{ summary }}</p>
		</template>
	</section>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
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

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const ARROW_STEPS: Record<string, number> = {
	ArrowUp: -1,
	ArrowDown: 1,
	ArrowLeft: -7,
	ArrowRight: 7,
}

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

const rows = computed(() =>
	WEEKDAYS.map((_, weekday) => cells.value.filter((_, index) => index % 7 === weekday)),
)

const months = computed(() => {
	const months: { key: string; label: string; weeks: number }[] = []
	for (let index = 0; index < cells.value.length; index += 7) {
		const date = dayjs(cells.value[index].date)
		const last = months.at(-1)
		if (last?.key === date.format('YYYY-MM')) last.weeks++
		else months.push({ key: date.format('YYYY-MM'), label: date.format('MMM'), weeks: 1 })
	}
	return months
})

const grid = useTemplateRef<HTMLTableElement>('grid')
const pickedDate = ref('')
const focusedDate = computed(() =>
	cells.value.some((cell) => cell.day && cell.date === pickedDate.value)
		? pickedDate.value
		: cells.value.at(-1)?.date,
)

function moveFocus(event: KeyboardEvent) {
	const step = ARROW_STEPS[event.key]
	if (!step) return
	event.preventDefault()
	const date = dayjs(focusedDate.value).add(step, 'day').format('YYYY-MM-DD')
	grid.value?.querySelector<HTMLElement>(`[data-date="${date}"]`)?.focus()
}

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
