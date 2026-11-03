<template>
	<section class="space-y-3 rounded-4 border border-outline-gray-1 p-4">
		<div>
			<h3 class="break-words text-base font-medium text-ink-gray-9">
				{{ question.section }}
			</h3>
			<p class="text-sm text-ink-gray-5">
				{{ question.marks }} {{ question.marks === 1 ? 'mark' : 'marks' }}
			</p>
		</div>

		<p
			class="whitespace-pre-wrap break-words text-lg text-ink-gray-9"
			v-text="question.question"
		/>

		<pre
			v-if="question.code"
			class="overflow-auto rounded-2 bg-surface-gray-2 p-3 font-mono text-base text-ink-gray-9 sm:text-lg"
			v-text="question.code"
		/>

		<div class="flex flex-wrap items-center justify-between gap-3">
			<Button
				:label="showAnswer ? 'Hide answer' : 'Show answer'"
				:icon-left="showAnswer ? 'lucide-eye-off' : 'lucide-eye'"
				@click="showAnswer = !showAnswer"
			/>
			<TabButtons
				:aria-label="`Marks for ${question.section}`"
				:model-value="marks"
				:options="markOptions"
				@update:model-value="emit('update:marks', Number($event))"
			/>
		</div>

		<p
			v-if="showAnswer"
			class="whitespace-pre-wrap break-words rounded-2 bg-surface-gray-2 p-3 text-base text-ink-gray-8"
			v-text="question.answer"
		/>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, TabButtons } from 'frappe-ui'
import type { VivaQuestion } from '@/lib/viva'

const props = defineProps<{
	question: VivaQuestion
	marks?: number
}>()

const emit = defineEmits<{ 'update:marks': [value: number] }>()

const showAnswer = ref(false)

const markOptions = computed(() =>
	Array.from({ length: props.question.marks + 1 }, (_, value) => ({
		label: String(value),
		value,
	})),
)
</script>
