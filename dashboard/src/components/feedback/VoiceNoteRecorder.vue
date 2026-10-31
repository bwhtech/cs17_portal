<template>
	<div class="space-y-2">
		<FormLabel label="Voice note" />
		<div class="flex items-center gap-3">
			<template v-if="isRecording">
				<Button label="Stop" icon-left="lucide-square" @click="recorder?.stop()" />
				<span
					role="timer"
					aria-label="Recording time"
					class="font-mono text-sm tabular-nums text-ink-gray-8"
				>
					{{ clock(seconds) }} / {{ clock(MAX_SECONDS) }}
				</span>
			</template>
			<template v-else-if="voiceNote">
				<audio :src="voiceNote" controls class="h-8 min-w-0 flex-1" />
				<Button
					variant="ghost"
					icon="lucide-trash-2"
					class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
					aria-label="Delete voice note"
					tooltip="Delete"
					@click="voiceNote = null"
				/>
			</template>
			<Button v-else label="Record" icon-left="lucide-mic" @click="start" />
		</div>
		<p
			v-if="error || microphoneError"
			data-slot="error"
			role="alert"
			class="break-words text-p-sm text-ink-red-5"
		>
			{{ error || microphoneError }}
		</p>
		<p v-else-if="description" class="text-p-xs text-ink-gray-5">{{ description }}</p>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onDeactivated, ref } from 'vue'
import { Button, FormLabel } from 'frappe-ui'

const MAX_SECONDS = 5 * 60

defineProps<{ error?: string; description?: string }>()

const voiceNote = defineModel<string | null>({ required: true })

const isRecording = ref(false)
const seconds = ref(0)
const microphoneError = ref('')
let recorder: MediaRecorder | undefined
let timer: ReturnType<typeof setInterval> | undefined

async function start() {
	microphoneError.value = ''
	let stream: MediaStream
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true })
	} catch {
		microphoneError.value = 'Allow microphone access to record a voice note.'
		return
	}
	const chunks: Blob[] = []
	const mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 })
	mediaRecorder.ondataavailable = (event) => chunks.push(event.data)
	mediaRecorder.onstop = () => {
		release()
		isRecording.value = false
		const reader = new FileReader()
		reader.onload = () => (voiceNote.value = reader.result as string)
		reader.readAsDataURL(new Blob(chunks, { type: mediaRecorder.mimeType }))
	}
	recorder = mediaRecorder
	mediaRecorder.start()
	isRecording.value = true
	seconds.value = 0
	timer = setInterval(() => {
		seconds.value += 1
		if (seconds.value >= MAX_SECONDS) mediaRecorder.stop()
	}, 1000)
}

function release() {
	clearInterval(timer)
	recorder?.stream.getTracks().forEach((track) => track.stop())
}

function clock(total: number): string {
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

defineExpose({ isRecording })

onDeactivated(() => {
	if (isRecording.value) recorder?.stop()
})

onBeforeUnmount(() => {
	if (recorder) recorder.onstop = null
	release()
})
</script>
