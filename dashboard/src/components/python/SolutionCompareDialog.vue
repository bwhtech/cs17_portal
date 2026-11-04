<template>
	<Dialog
		:open="open"
		title="Compare with my code"
		size="5xl"
		@update:open="emit('update:open', $event)"
	>
		<div class="grid gap-4 md:grid-cols-2">
			<section aria-label="Your code" class="min-w-0">
				<h3 class="text-base-medium text-ink-gray-8">Your code</h3>
				<div class="mt-2 max-h-[60vh] overflow-auto rounded-3">
					<PythonEditor :model-value="code" read-only :extensions="wrapLines" />
				</div>
			</section>
			<section aria-label="Solution" class="min-w-0">
				<h3 class="text-base-medium text-ink-gray-8">Solution</h3>
				<SolutionTabs class="mt-2" :solutions="solutions" />
			</section>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { EditorView } from '@codemirror/view'
import { Dialog } from 'frappe-ui'
import PythonEditor from '@/components/python/PythonEditor.vue'
import SolutionTabs from '@/components/python/SolutionTabs.vue'
import type { PythonSolution } from '@/types'

defineProps<{ open: boolean; code: string; solutions: PythonSolution[] }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const wrapLines = [EditorView.lineWrapping]
</script>
