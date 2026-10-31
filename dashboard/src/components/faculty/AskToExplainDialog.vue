<template>
	<Dialog
		:open="open"
		:title="`Ask to explain: ${studentName}`"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<FormControl
				v-model="question"
				type="textarea"
				label="Question"
				placeholder="Walk me through how your program works."
				description="The student answers with a voice note of up to 5 minutes."
				:rows="3"
			/>
			<ErrorMessage v-if="saveError" :message="saveError" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Send"
				:loading="askToExplain.loading"
				@click="send"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{ open: boolean; submission: string; studentName: string }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const question = ref('')
const saveError = ref('')

const askToExplain = useCall<null, { submission: string; question: string }>({
	url: '/api/v2/method/cs17_portal.explanations.request_explanation',
	method: 'POST',
	immediate: false,
})

watch(
	() => props.submission,
	() => {
		question.value = ''
		saveError.value = ''
	},
)

async function send() {
	saveError.value = ''
	await trySubmit(askToExplain, { submission: props.submission, question: question.value.trim() })

	if (askToExplain.error) {
		saveError.value = frappeErrorMessage(askToExplain.error, 'Could not send the request.')
		return
	}
	question.value = ''
	toast.success(`Asked ${props.studentName} to explain.`)
	emit('success')
	emit('update:open', false)
}
</script>
