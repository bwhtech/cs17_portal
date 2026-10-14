<template>
	<p v-if="attempt.data" class="flex items-center gap-1.5 text-base text-ink-gray-8">
		<span class="lucide-timer size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
		Started {{ formatDateTime(attempt.data.started_at) }} · took {{ minutesTaken }} of
		{{ timeLimit }} min
	</p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCall } from 'frappe-ui'
import { formatDateTime, parseDatetime } from '@/lib/dates'

interface Attempt {
	started_at: string
	submitted_at: string
}

const props = defineProps<{ submission: string; timeLimit: number }>()

const attempt = useCall<Attempt | null, { submission: string }>({
	url: '/api/v2/method/cs17_portal.api.get_assignment_attempt',
	params: () => ({ submission: props.submission }),
})

const minutesTaken = computed(() => {
	if (!attempt.data) return 0
	const taken =
		parseDatetime(attempt.data.submitted_at).valueOf() -
		parseDatetime(attempt.data.started_at).valueOf()
	return Math.round(taken / 60000)
})
</script>
