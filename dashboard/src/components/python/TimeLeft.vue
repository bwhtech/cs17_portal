<template>
	<span
		role="timer"
		aria-label="Time left"
		class="flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums"
		:class="seconds < 60 ? 'text-ink-red-6' : 'text-ink-gray-8'"
	>
		<span class="lucide-timer size-4 max-sm:hidden" aria-hidden="true" />
		{{ clock }}
	</span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { parseDatetime } from '@/lib/dates'

const props = defineProps<{ endsAt: string; now: string }>()

const emit = defineEmits<{ end: [] }>()

const localEndsAt =
	Date.now() + parseDatetime(props.endsAt).valueOf() - parseDatetime(props.now).valueOf()
const seconds = ref(secondsLeft())
const timer = setInterval(tick, 1000)

function secondsLeft(): number {
	return Math.max(0, Math.ceil((localEndsAt - Date.now()) / 1000))
}

function tick() {
	seconds.value = secondsLeft()
	if (seconds.value) return
	clearInterval(timer)
	emit('end')
}

const clock = computed(
	() =>
		`${String(Math.floor(seconds.value / 60)).padStart(2, '0')}:${String(seconds.value % 60).padStart(2, '0')}`,
)

onBeforeUnmount(() => clearInterval(timer))
</script>
