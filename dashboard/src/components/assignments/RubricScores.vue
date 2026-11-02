<template>
	<ul class="space-y-1" aria-label="Marks by criterion">
		<li
			v-for="(score, index) in scores"
			:key="index"
			class="flex items-baseline justify-between gap-3 text-sm"
		>
			<span class="min-w-0 break-words text-ink-gray-7">{{ score.criterion }}</span>
			<span class="shrink-0 text-ink-gray-8">
				{{ formatMarks(score.marks, score.max_marks) }}
			</span>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { formatMarks } from '@/lib/results'
import type { RubricScore } from '@/lib/rubric'

defineProps<{ scores: RubricScore[] }>()
</script>
