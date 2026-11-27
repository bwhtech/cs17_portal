<template>
	<LoadError
		v-if="failed"
		title="Could not load the day"
		:loading="day.loading"
		@retry="day.reload()"
	/>

	<div v-else-if="!day.data" class="cs17-delay-in grid gap-6 md:grid-cols-2">
		<div class="space-y-3">
			<Skeleton class="h-6 w-full rounded-2" />
			<Skeleton v-for="n in 3" :key="n" class="h-10 w-full rounded-2" />
		</div>
		<div class="space-y-3">
			<Skeleton v-for="n in 4" :key="n" class="h-8 w-full rounded-2" />
		</div>
	</div>

	<div v-else class="grid gap-6 md:grid-cols-2">
		<div class="min-w-0 space-y-4">
			<section aria-label="Day timeline" class="space-y-1.5">
				<div class="relative h-6 overflow-hidden rounded-2 bg-surface-gray-1">
					<span
						class="absolute inset-y-0 bg-surface-gray-2"
						:style="span(day.data.practice_hours.start, day.data.practice_hours.end)"
					/>
					<span
						v-for="window in day.data.idle"
						:key="window.from"
						class="absolute inset-y-0 bg-surface-red-3"
						:style="span(window.from, window.to)"
					/>
					<span
						v-for="(event, index) in day.data.events"
						:key="index"
						class="absolute inset-y-1 w-0.5 -translate-x-1/2 rounded-full"
						:class="
							event.kind === 'submit' ? 'bg-surface-green-5' : 'bg-surface-gray-7'
						"
						:style="{ left: `${position(event.at)}%` }"
					/>
				</div>
				<div class="flex justify-between text-xs text-ink-gray-5" aria-hidden="true">
					<span v-for="(label, index) in AXIS" :key="index">{{ label }}</span>
				</div>
			</section>

			<ul v-if="day.data.idle.length" class="space-y-1 text-sm text-ink-gray-7">
				<li
					v-for="window in day.data.idle"
					:key="window.from"
					class="flex items-center gap-2"
				>
					<span class="size-2 shrink-0 rounded-full bg-surface-red-3" />
					No work recorded {{ time(window.from) }} to {{ time(window.to) }}
				</li>
			</ul>

			<section>
				<h3 class="text-sm font-medium text-ink-gray-8">Worked on</h3>
				<p v-if="!day.data.assignments.length" class="mt-1.5 text-base text-ink-gray-5">
					No work on this day.
				</p>
				<ul v-else class="divide-y divide-outline-gray-1">
					<li
						v-for="row in day.data.assignments"
						:key="row.assignment"
						class="flex items-center justify-between gap-3 py-2.5"
					>
						<div class="min-w-0">
							<p class="truncate text-base text-ink-gray-8">{{ row.title }}</p>
							<p class="mt-1 text-sm text-ink-gray-5">
								{{ when(row) }} · {{ summary(row) }}
							</p>
						</div>
						<Badge
							v-if="row.submitted"
							label="Submitted"
							theme="green"
							variant="subtle"
						/>
					</li>
				</ul>
			</section>
		</div>

		<NotStartedList class="min-w-0" :assignments="day.data.not_started" />
	</div>
</template>

<script setup lang="ts">
import { Badge, Skeleton, useCall } from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import NotStartedList from '@/components/reports/NotStartedList.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { dayjs, parseDatetime } from '@/lib/dates'
import type { AssignmentActivity, NotStartedAssignment } from '@/types'

interface StudentDay {
	date: string
	practice_hours: { start: string; end: string }
	events: { at: string; kind: 'start' | 'save' | 'run' | 'submit' }[]
	idle: { from: string; to: string }[]
	not_started: NotStartedAssignment[]
	assignments: AssignmentActivity[]
}

const props = defineProps<{ student: string; date: string }>()

const AXIS = ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM']

const day = useCall<StudentDay, { student: string; date: string }>({
	url: '/api/v2/method/cs17_portal.class_activity.get_student_day',
	method: 'GET',
	params: () => ({ student: props.student, date: props.date }),
	refetch: true,
})

const failed = useLoadFailed(day)

function position(at: string): number {
	const time = dayjs(at)
	return ((time.hour() * 60 + time.minute()) / (24 * 60)) * 100
}

function span(from: string, to: string) {
	return { left: `${position(from)}%`, width: `${position(to) - position(from)}%` }
}

function time(at: string): string {
	return parseDatetime(at).format('h:mm A')
}

function when(row: AssignmentActivity): string {
	const [first, last] = [row.first_active_at, row.last_active_at].map(time)
	return first === last ? first : `${first} to ${last}`
}

function summary(row: AssignmentActivity): string {
	if (!row.runs) return row.typed ? 'Typed, never ran' : 'Opened, nothing typed'
	const runs = row.runs === 1 ? '1 run' : `${row.runs} runs`
	return row.total ? `${runs}, ${row.passed} of ${row.total} tests passed` : runs
}
</script>
