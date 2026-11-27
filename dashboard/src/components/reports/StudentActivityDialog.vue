<template>
	<Dialog
		:open="open"
		:title="student?.full_name ?? ''"
		@update:open="emit('update:open', $event)"
	>
		<StudentDayTimeline v-if="student" :student="student.student" :date="date" />

		<h3 class="mt-5 text-sm font-medium text-ink-gray-8">Worked on</h3>
		<p v-if="!student?.assignments.length" class="mt-1.5 text-base text-ink-gray-5">
			No work on this day.
		</p>
		<ul v-else class="divide-y divide-outline-gray-1">
			<li
				v-for="row in student.assignments"
				:key="row.assignment"
				class="flex items-center justify-between gap-3 py-2.5"
			>
				<div class="min-w-0">
					<p class="truncate text-base text-ink-gray-8">{{ row.title }}</p>
					<p class="mt-1 text-sm text-ink-gray-5">{{ when(row) }} · {{ summary(row) }}</p>
				</div>
				<Badge v-if="row.submitted" label="Submitted" theme="green" variant="subtle" />
			</li>
		</ul>
	</Dialog>
</template>

<script setup lang="ts">
import { Badge, Dialog } from 'frappe-ui'
import StudentDayTimeline from '@/components/reports/StudentDayTimeline.vue'
import { parseDatetime } from '@/lib/dates'
import type { AssignmentActivity, StudentActivity } from '@/types'

defineProps<{ open: boolean; student: StudentActivity | null; date: string }>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function when(row: AssignmentActivity): string {
	const [first, last] = [row.first_active_at, row.last_active_at].map((at) =>
		parseDatetime(at).format('h:mm A'),
	)
	return first === last ? first : `${first} to ${last}`
}

function summary(row: AssignmentActivity): string {
	if (!row.runs) return row.typed ? 'Typed, never ran' : 'Opened, nothing typed'
	const runs = row.runs === 1 ? '1 run' : `${row.runs} runs`
	return row.total ? `${runs}, ${row.passed} of ${row.total} tests passed` : runs
}
</script>
