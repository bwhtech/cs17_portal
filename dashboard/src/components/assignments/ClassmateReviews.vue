<template>
	<section
		v-if="received.data?.length"
		class="rounded-4 border border-outline-gray-1 bg-surface-base p-4"
	>
		<h2 class="text-base-medium text-ink-gray-8">What your classmates said</h2>
		<ul class="mt-1 divide-y divide-outline-gray-1">
			<li v-for="review in received.data" :key="review.name" class="space-y-2 py-3">
				<div>
					<p class="text-xs text-ink-gray-5">What works well</p>
					<p class="whitespace-pre-line text-p-base text-ink-gray-8" dir="auto">
						{{ review.strengths }}
					</p>
				</div>
				<div>
					<p class="text-xs text-ink-gray-5">One thing to improve</p>
					<p class="whitespace-pre-line text-p-base text-ink-gray-8" dir="auto">
						{{ review.improvement }}
					</p>
				</div>
			</li>
		</ul>
	</section>
	<ErrorMessage v-else-if="received.error" message="Could not load what your classmates said." />
</template>

<script setup lang="ts">
import { ErrorMessage, useCall } from 'frappe-ui'

interface ReceivedReview {
	name: string
	strengths: string
	improvement: string
}

const props = defineProps<{ assignment: string }>()

const received = useCall<ReceivedReview[], { assignment: string }>({
	url: '/api/v2/method/cs17_portal.peer_review.get_reviews_of_my_work',
	params: () => ({ assignment: props.assignment }),
	refetch: true,
})
</script>
