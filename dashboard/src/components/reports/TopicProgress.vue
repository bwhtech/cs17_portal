<template>
	<section v-if="failed || topics?.some((topic) => topic.average !== null)">
		<slot />
		<ErrorMessage v-if="failed" message="Could not load progress by topic." />
		<ul v-else class="space-y-4">
			<li v-for="topic in topics" :key="topic.topic" class="space-y-2">
				<Progress :label="topic.topic" :value="topic.average ?? 0" size="md" hint>
					<template #hint>
						<span class="text-base-medium text-ink-gray-6">
							{{ formatPercent(topic.average) }}
						</span>
					</template>
				</Progress>
				<p class="text-sm text-ink-gray-5">
					{{ topic.submitted }} of {{ topic.given }} submitted
				</p>
			</li>
		</ul>
	</section>
</template>

<script setup lang="ts">
import { ErrorMessage, Progress } from 'frappe-ui'
import { formatPercent } from '@/lib/results'

export interface TopicProgressRow {
	topic: string
	given: number
	submitted: number
	average: number | null
}

defineProps<{
	topics?: TopicProgressRow[] | null
	failed?: boolean
}>()
</script>
