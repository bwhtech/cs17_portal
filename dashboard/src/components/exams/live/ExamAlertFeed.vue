<template>
	<section class="space-y-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-lg font-semibold text-ink-gray-8">Alerts</h2>
			<div class="flex items-center gap-3">
				<Switch v-model="soundOn" label="Sound" />
				<Button
					v-if="canNotify && permission !== 'granted'"
					icon-left="lucide-bell"
					label="Notify me"
					@click="askToNotify"
				/>
			</div>
		</div>
		<p v-if="permission === 'granted'" class="text-sm text-ink-gray-5">
			New alerts show as a notification while this tab is in the background.
		</p>

		<EmptyState v-if="!events.length" icon="lucide-shield-check" title="No alerts yet" />
		<ul
			v-else
			class="divide-y divide-outline-gray-1 rounded-4 border border-outline-gray-1 bg-surface-base lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto"
		>
			<li v-for="event in events" :key="event.name" class="px-4 py-2.5">
				<p class="text-base text-ink-gray-8">{{ alertText(event, questions) }}</p>
				<p class="mt-1 text-sm text-ink-gray-5">
					{{ parseDatetime(event.occurred_at).format('h:mm A') }}
				</p>
			</li>
		</ul>
	</section>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { Button, Switch, toast } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import { alertText, type ExamEvent, type LiveQuestion } from '@/components/exams/live/examLive'
import { parseDatetime } from '@/lib/dates'
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage'

const props = defineProps<{ examTitle: string; events: ExamEvent[]; questions: LiveQuestion[] }>()

const canNotify = 'Notification' in window
const permission = ref(canNotify ? Notification.permission : 'denied')

async function askToNotify() {
	permission.value = await Notification.requestPermission()
	if (permission.value === 'denied') {
		toast.error('Notifications are blocked for this site. Allow them in your browser settings.')
	}
}

const soundOn = ref(readJSON(STORAGE_KEYS.examAlertSound, false))
let audio: AudioContext | null = null

function playSound() {
	audio ??= new AudioContext()
	const tone = audio.createOscillator()
	const volume = audio.createGain()
	volume.gain.setValueAtTime(0.2, audio.currentTime)
	volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4)
	tone.connect(volume).connect(audio.destination)
	tone.start()
	tone.stop(audio.currentTime + 0.4)
}

watch(soundOn, (on) => {
	writeJSON(STORAGE_KEYS.examAlertSound, on)
	if (on) playSound()
})

onUnmounted(() => audio?.close())

watch(
	() => props.events,
	(events, previous) => {
		const known = new Set(previous.map((event) => event.name))
		const fresh = events.filter((event) => !known.has(event.name))
		if (!fresh.length) return
		const message =
			fresh.length === 1 ? alertText(fresh[0], props.questions) : `${fresh.length} new alerts`
		toast.warning(message)
		if (soundOn.value) playSound()
		if (permission.value === 'granted' && (document.hidden || !document.hasFocus())) {
			const notification = new Notification(props.examTitle, { body: message })
			notification.onclick = () => window.focus()
		}
	},
)
</script>
