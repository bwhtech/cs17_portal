<template>
	<AppHeader title="Share feedback" />

	<PageBody width="narrow">
		<form class="space-y-4" @submit.prevent="submitFeedback">
			<AnnouncementAlert
				title="Your identity will remain private, and no personal details will be shared."
			/>

			<FormControl
				v-model="category"
				type="select"
				label="Category"
				placeholder="Select a category"
				:options="['Food', 'Stay', 'Other']"
				side="bottom"
				required
			/>

			<FormControl
				v-model="description"
				type="textarea"
				label="Description"
				placeholder="Write your feedback"
				:rows="6"
				required
			/>

			<Button
				type="submit"
				variant="solid"
				label="Submit"
				:loading="submitCall.loading"
				:disabled="!category || !description.trim()"
			/>
		</form>
	</PageBody>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button, FormControl, toast, useCall } from 'frappe-ui'
import AnnouncementAlert from '@/components/announcements/AnnouncementAlert.vue'
import PageBody from '@/components/common/PageBody.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const category = ref('')
const description = ref('')

const submitCall = useCall<null, { category: string; description: string }>({
	url: '/api/v2/method/cs17_portal.api.submit_feedback',
	method: 'POST',
	immediate: false,
})

async function submitFeedback() {
	await trySubmit(submitCall, { category: category.value, description: description.value })
	if (submitCall.error) {
		toast.error(frappeErrorMessage(submitCall.error, 'Could not send your feedback.'))
		return
	}
	toast.success('Feedback sent')
	category.value = ''
	description.value = ''
}
</script>
