<template>
	<RouterLink
		:to="`/exams/${exam.name}`"
		class="flex items-center gap-3 rounded-4 border border-outline-gray-1 bg-surface-base p-4 hover:bg-surface-gray-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
	>
		<span class="rounded-full bg-surface-gray-2 p-2 text-ink-gray-6">
			<span class="lucide-timer block size-5" aria-hidden="true" />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate text-base text-ink-gray-8">{{ exam.title }}</span>
			<span class="mt-1 block text-sm text-ink-gray-5">{{ when }}</span>
		</span>
		<Badge :label="EXAM_STATES[exam.state].label" :theme="EXAM_STATES[exam.state].theme" />
	</RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Badge } from 'frappe-ui'
import { EXAM_STATES, formatDuration, type CodingExamSummary } from '@/components/exams/codingExam'
import { formatDateTime } from '@/lib/dates'

const props = defineProps<{ exam: CodingExamSummary }>()

const when = computed(() => {
	const { state, opens_on, last_start_on, closes_on, duration_minutes } = props.exam
	if (state === 'in_progress') return `Closes ${formatDateTime(closes_on)}`
	const duration = formatDuration(duration_minutes)
	if (state === 'open') return `Start by ${formatDateTime(last_start_on)} · ${duration}`
	return `Opens ${formatDateTime(opens_on)} · ${duration}`
})
</script>
