<template>
	<div class="space-y-5">
		<p v-if="assignment.due_date" class="text-sm text-ink-gray-5">
			Due {{ formatDateTime(assignment.due_date) }}
		</p>

		<p
			v-if="assignment.watch_tab_switches"
			class="flex items-center gap-1.5 text-p-sm text-ink-gray-7"
		>
			<span class="lucide-eye size-4 shrink-0" aria-hidden="true" />
			Your teacher can see when you leave this tab.
		</p>

		<MarkdownText :content="assignment.description" />

		<section v-if="assignment.sample_tests?.length" class="space-y-4">
			<div v-for="(test, index) in assignment.sample_tests" :key="index" class="space-y-2">
				<p class="text-base font-medium text-ink-gray-8">Example {{ index + 1 }}</p>
				<div class="grid gap-2 sm:grid-cols-2">
					<ProgramText label="Input" :text="test.input" />
					<ProgramText label="Expected output" :text="test.expected_output" />
				</div>
			</div>
		</section>

		<p v-if="assignment.hidden_test_count" class="text-p-sm text-ink-gray-5">
			Your teacher also checks {{ assignment.hidden_test_count }} hidden
			{{ assignment.hidden_test_count === 1 ? 'test' : 'tests' }} after you submit.
		</p>
	</div>
</template>

<script setup lang="ts">
import MarkdownText from '@/components/common/MarkdownText.vue'
import ProgramText from '@/components/python/ProgramText.vue'
import { formatDateTime } from '@/lib/dates'
import type { CS17Assignment } from '@/types'

defineProps<{ assignment: CS17Assignment }>()
</script>
