<template>
	<section>
		<h3 class="text-sm font-medium text-ink-gray-8">Not started</h3>
		<p v-if="!assignments.length" class="mt-1.5 text-base text-ink-gray-5">
			Every assignment is started.
		</p>

		<ul v-if="dated.length" class="divide-y divide-outline-gray-1">
			<li
				v-for="row in dated"
				:key="row.assignment"
				class="flex items-center justify-between gap-3 py-2.5"
			>
				<span class="min-w-0 truncate text-base text-ink-gray-8">{{ row.title }}</span>
				<span class="shrink-0 text-sm text-ink-gray-5">
					Due {{ formatDate(row.due_date) }}
				</span>
			</li>
		</ul>

		<template v-if="practice.length">
			<h4 class="mt-3 text-sm text-ink-gray-5">Practice</h4>
			<CollapsibleSection
				v-for="group in practice"
				:key="group.topic"
				:label="group.topic"
				:count="group.titles.length"
			>
				<ul class="space-y-1 pb-2 pl-6 text-sm text-ink-gray-7">
					<li v-for="title in group.titles" :key="title" class="truncate">{{ title }}</li>
				</ul>
			</CollapsibleSection>
		</template>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CollapsibleSection from '@/components/common/CollapsibleSection.vue'
import { formatDate } from '@/lib/dates'
import type { NotStartedAssignment } from '@/types'

const NO_TOPIC = 'No topic'

const props = defineProps<{ assignments: NotStartedAssignment[] }>()

const dated = computed(() => props.assignments.filter((row) => row.due_date))

const practice = computed(() => {
	const groups = new Map<string, string[]>()
	for (const row of props.assignments) {
		if (row.due_date) continue
		const topic = row.topic || NO_TOPIC
		groups.set(topic, [...(groups.get(topic) ?? []), row.title])
	}
	return [...groups]
		.map(([topic, titles]) => ({ topic, titles: titles.sort() }))
		.sort(
			(a, b) =>
				Number(a.topic === NO_TOPIC) - Number(b.topic === NO_TOPIC) ||
				a.topic.localeCompare(b.topic),
		)
})
</script>
