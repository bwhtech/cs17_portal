<template>
	<Dialog v-model:open="isOpen" title="Share feedback">
		<template #default>
			<div class="space-y-4">
				<FormControl
					v-model="category"
					type="select"
					label="Category"
					placeholder="Select a category"
					:options="[...FEEDBACK_CATEGORIES]"
					required
					:error="fieldErrors.category"
				/>

				<FormControl
					v-model="description"
					type="textarea"
					label="Description"
					placeholder="Write your feedback"
					description="Faculty don't see your name."
					:rows="6"
					required
					:error="fieldErrors.description"
				/>

				<ErrorMessage :message="formError" />
			</div>
		</template>

		<template #actions="{ close }">
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="close" />
				<Button
					variant="solid"
					theme="gray"
					label="Send"
					:loading="submitCall.loading"
					@click="send"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, toast, useCall } from 'frappe-ui'
import { useFeedbackDialog } from '@/composables/useFeedbackDialog'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import { FEEDBACK_CATEGORIES } from '@/types'

const { isOpen } = useFeedbackDialog()

const category = ref('')
const description = ref('')
const formError = ref('')
const fieldErrors = reactive({ category: '', description: '' })

const submitCall = useCall<null, { category: string; description: string }>({
	url: '/api/v2/method/cs17_portal.api.submit_feedback',
	method: 'POST',
	immediate: false,
})

watch(isOpen, (open) => {
	if (!open) return
	category.value = ''
	description.value = ''
	formError.value = ''
	fieldErrors.category = ''
	fieldErrors.description = ''
})

async function send() {
	fieldErrors.category = category.value ? '' : 'Category is required.'
	fieldErrors.description = description.value.trim() ? '' : 'Description is required.'
	if (fieldErrors.category || fieldErrors.description) return

	await trySubmit(submitCall, { category: category.value, description: description.value })
	if (submitCall.error) {
		formError.value = frappeErrorMessage(submitCall.error, 'Could not send your feedback.')
		return
	}

	toast.success('Feedback sent')
	isOpen.value = false
}
</script>
