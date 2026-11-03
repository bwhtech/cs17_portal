<template>
	<Dialog :open="open" :title="title" size="5xl" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<div
				class="h-[75vh] overflow-hidden rounded-4 border border-outline-gray-1 md:h-[60vh]"
			>
				<div
					v-if="failed || isRefusal(code.error)"
					class="flex h-full items-center justify-center p-6 text-center"
				>
					<p v-if="isRefusal(code.error)" class="text-p-base text-ink-gray-5">
						{{ frappeErrorMessage(code.error, 'Could not open this code.') }}
					</p>
					<LoadError
						v-else
						class="!py-0"
						title="Could not open this code"
						:loading="code.loading"
						@retry="code.reload()"
					/>
				</div>
				<Skeleton v-else-if="typeof code.data !== 'string'" class="h-full w-full" />
				<GalleryPythonView v-else :code="code.data" />
			</div>
			<FormControl
				v-model="strengths"
				type="textarea"
				label="What works well?"
				:rows="3"
				required
				:error="strengthsError"
			/>
			<FormControl
				v-model="improvement"
				type="textarea"
				label="One thing to improve"
				:rows="3"
				required
				:error="improvementError"
			/>
			<ErrorMessage :message="sendError" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Send"
				:loading="send.loading"
				@click="sendReview"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, Skeleton, toast, useCall } from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import GalleryPythonView from '@/components/gallery/GalleryPythonView.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const MIN_ANSWER_LENGTH = 15

const props = defineProps<{ open: boolean; review: string; title: string }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; sent: [] }>()

const code = useCall<string, { review: string }>({
	url: '/api/v2/method/cs17_portal.peer_review.get_review_code',
	params: () => ({ review: props.review }),
})

const failed = useLoadFailed(code, { except: isRefusal })

const send = useCall<null, { review: string; strengths: string; improvement: string }>({
	url: '/api/v2/method/cs17_portal.peer_review.submit_review',
	method: 'POST',
	immediate: false,
})

const strengths = ref('')
const improvement = ref('')
const strengthsError = ref('')
const improvementError = ref('')
const sendError = ref('')

watch(strengths, () => (strengthsError.value = ''))
watch(improvement, () => (improvementError.value = ''))

function lengthError(answer: string): string {
	return answer.trim().length < MIN_ANSWER_LENGTH
		? `Write at least ${MIN_ANSWER_LENGTH} characters.`
		: ''
}

async function sendReview() {
	strengthsError.value = lengthError(strengths.value)
	improvementError.value = lengthError(improvement.value)
	sendError.value = ''
	if (strengthsError.value || improvementError.value) return

	await trySubmit(send, {
		review: props.review,
		strengths: strengths.value,
		improvement: improvement.value,
	})
	if (send.error) {
		sendError.value = frappeErrorMessage(send.error, 'Could not send your review.')
		return
	}
	toast.success('Review sent')
	emit('sent')
	emit('update:open', false)
}
</script>
