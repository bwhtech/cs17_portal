<template>
	<Dialog
		:open="open"
		:title="`Send back: ${studentName}`"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<FormControl
				v-model="reason"
				type="textarea"
				label="What should they change?"
				description="The student sees this, and can submit again even after the due date. A published grade is hidden until you grade the new work."
				:rows="4"
				:error="reasonError"
				required
			/>
			<ErrorMessage v-if="saveError" :message="saveError" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Send back"
				:loading="sendBack.loading"
				@click="handleSendBack"
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

const reason = ref('')
const reasonError = ref('')
const saveError = ref('')

const sendBack = useCall<null, { submission: string; reason: string }>({
	url: '/api/v2/method/cs17_portal.api.send_back_submission',
	method: 'POST',
	immediate: false,
})

watch(
	() => props.submission,
	() => {
		reason.value = ''
		reasonError.value = ''
		saveError.value = ''
	},
)

watch(reason, () => {
	reasonError.value = ''
})

async function handleSendBack() {
	saveError.value = ''
	reasonError.value = reason.value.trim() ? '' : 'Say what the student should change.'
	if (reasonError.value) return

	await trySubmit(sendBack, { submission: props.submission, reason: reason.value.trim() })

	if (sendBack.error) {
		saveError.value = frappeErrorMessage(sendBack.error, 'Could not send it back.')
		return
	}
	toast.success(`Sent back to ${props.studentName}.`)
	emit('success')
	emit('update:open', false)
}
</script>
