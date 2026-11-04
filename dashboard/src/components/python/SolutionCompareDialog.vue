<template>
	<Dialog
		:open="open"
		title="Compare with my code"
		size="5xl"
		@update:open="emit('update:open', $event)"
	>
		<div class="grid gap-4 md:grid-cols-2">
			<section aria-label="Your code" class="min-w-0">
				<div class="flex h-8 items-center">
					<h3 class="text-base-medium text-ink-gray-8">Your code</h3>
				</div>
				<div class="mt-2 max-h-[60vh] overflow-auto rounded-3">
					<PythonEditor :model-value="code" read-only :extensions="wrapLines" />
				</div>
			</section>
			<section aria-label="Solution" class="min-w-0">
				<div class="flex h-8 items-center justify-between gap-3">
					<h3 class="text-base-medium text-ink-gray-8">Solution</h3>
					<Select
						v-if="solutions.length > 1"
						class="w-48"
						aria-label="Way to solve it"
						:model-value="String(picked)"
						:options="options"
						@update:model-value="picked = Number($event)"
					/>
				</div>
				<div class="mt-2 max-h-[60vh] overflow-auto rounded-3">
					<PythonEditor
						:model-value="solutions[picked]?.code ?? ''"
						read-only
						:extensions="wrapLines"
					/>
				</div>
			</section>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EditorView } from '@codemirror/view'
import { Dialog, Select } from 'frappe-ui'
import PythonEditor from '@/components/python/PythonEditor.vue'
import type { PythonSolution } from '@/types'

const props = defineProps<{ open: boolean; code: string; solutions: PythonSolution[] }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const wrapLines = [EditorView.lineWrapping]
const picked = ref(0)
const options = computed(() =>
	props.solutions.map((solution, index) => ({ label: solution.label, value: String(index) })),
)
</script>
