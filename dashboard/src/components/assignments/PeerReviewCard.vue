<template>
	<section
		v-if="toWrite.data?.length"
		class="rounded-4 border border-outline-gray-1 bg-surface-base p-4"
	>
		<h2 class="text-base-medium text-ink-gray-8">Review your classmates</h2>
		<p class="mt-1 text-p-sm text-ink-gray-5">
			Read their code, then say what works well and one thing to improve. They do not see your
			name.
		</p>
		<ul class="mt-2 divide-y divide-outline-gray-1">
			<li
				v-for="(review, index) in toWrite.data"
				:key="review.name"
				class="flex items-center justify-between gap-3 py-2"
			>
				<span class="text-base text-ink-gray-8">Classmate {{ index + 1 }}</span>
				<Badge v-if="review.submitted_on" label="Sent" theme="green" variant="subtle" />
				<Button v-else label="Review" @click="target = { review: review.name, index }" />
			</li>
		</ul>

		<ReviewClassmateDialog
			v-if="target"
			:open="Boolean(target)"
			:review="target.review"
			:title="`Classmate ${target.index + 1}`"
			@update:open="target = null"
			@sent="toWrite.reload()"
		/>
	</section>
	<ErrorMessage v-else-if="toWrite.error" message="Could not load your reviews." />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Badge, Button, ErrorMessage, useCall } from 'frappe-ui'
import ReviewClassmateDialog from '@/components/assignments/ReviewClassmateDialog.vue'

interface ReviewToWrite {
	name: string
	submitted_on: string | null
}

const props = defineProps<{ assignment: string }>()

const toWrite = useCall<ReviewToWrite[], { assignment: string }>({
	url: '/api/v2/method/cs17_portal.peer_review.get_reviews_to_write',
	params: () => ({ assignment: props.assignment }),
	refetch: true,
})

const target = ref<{ review: string; index: number } | null>(null)
</script>
