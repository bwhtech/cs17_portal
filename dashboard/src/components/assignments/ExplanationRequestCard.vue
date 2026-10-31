<template>
	<section
		v-if="explanation.data"
		class="rounded-4 border border-outline-gray-1 bg-surface-base p-4"
	>
		<h2 class="text-base-medium text-ink-gray-8">Explain your code</h2>
		<p class="mt-1 whitespace-pre-line text-p-base text-ink-gray-8" dir="auto">
			{{ explanation.data.question || 'Walk me through how your program works.' }}
		</p>
		<div v-if="explanation.data.voice_note" class="mt-3">
			<p class="text-sm text-ink-gray-5">
				Sent {{ formatDateTime(explanation.data.answered_on) }}
			</p>
			<audio :src="explanation.data.voice_note" controls class="mt-1 h-8 w-full" />
		</div>
		<div v-else class="mt-3 space-y-3">
			<VoiceNoteRecorder
				ref="recorder"
				v-model="voiceNote"
				description="Talk your teacher through your code in your own words."
				:error="voiceNoteError"
			/>
			<Button label="Send" :loading="answer.loading" @click="send(explanation.data.name)" />
		</div>
	</section>
	<ErrorMessage v-else-if="explanation.error" message="Could not load your teacher's request." />
</template>

<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import { Button, ErrorMessage, toast, useCall } from 'frappe-ui'
import VoiceNoteRecorder from '@/components/feedback/VoiceNoteRecorder.vue'
import { formatDateTime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

interface ExplanationRequest {
	name: string
	question: string | null
	answered_on: string | null
	voice_note: string | null
}

const props = defineProps<{ submission: string }>()

const explanation = useCall<ExplanationRequest | null, { submission: string }>({
	url: '/api/v2/method/cs17_portal.explanations.get_my_explanation_request',
	method: 'GET',
	params: () => ({ submission: props.submission }),
	refetch: true,
})

const answer = useCall<null, { request: string; voice_note: string }>({
	url: '/api/v2/method/cs17_portal.explanations.answer_explanation_request',
	method: 'POST',
	immediate: false,
})

const voiceNote = ref<string | null>(null)
const voiceNoteError = ref('')
const recorder = useTemplateRef<InstanceType<typeof VoiceNoteRecorder>>('recorder')

watch(voiceNote, () => (voiceNoteError.value = ''))

async function send(request: string) {
	const isRecording = Boolean(recorder.value?.isRecording)
	if (isRecording || !voiceNote.value) {
		voiceNoteError.value = isRecording
			? 'Stop recording before you send.'
			: 'Record your explanation first.'
		return
	}

	await trySubmit(answer, { request, voice_note: voiceNote.value })
	if (answer.error) {
		voiceNoteError.value = frappeErrorMessage(answer.error, 'Could not send your explanation.')
		return
	}
	toast.success('Explanation sent')
	explanation.reload()
}
</script>
