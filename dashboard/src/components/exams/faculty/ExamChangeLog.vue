<template>
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-ink-gray-8">Changes</h2>
		<ul
			class="divide-y divide-outline-gray-1 rounded-4 border border-outline-gray-1 bg-surface-base"
		>
			<li v-for="(change, index) in changes" :key="index" class="px-4 py-2.5">
				<p class="text-base text-ink-gray-8" dir="auto">{{ change.change }}</p>
				<p class="mt-1 text-sm text-ink-gray-5">
					{{ change.changed_by_name ?? change.changed_by }} ·
					{{ formatDateTime(change.changed_on) }}
				</p>
			</li>
		</ul>
	</section>
</template>

<script setup lang="ts">
import type { CodingExamChange } from '@/components/exams/faculty/codingExam'
import { formatDateTime } from '@/lib/dates'

defineProps<{ changes: CodingExamChange[] }>()
</script>
