<template>
	<div class="space-y-2">
		<FormLabel label="Rubric" />
		<p class="text-p-sm text-ink-gray-5">
			Split the marks into criteria. You grade each one, and students see the marks for each
			criterion with their grade.
		</p>

		<div v-for="(row, index) in rubric" :key="index" class="flex items-start gap-3">
			<FormControl
				class="min-w-0 flex-1"
				type="text"
				label="Criterion"
				maxlength="140"
				:model-value="row.criterion"
				:error="errors[index]?.criterion"
				@update:model-value="update(index, { criterion: String($event ?? '') })"
			/>
			<FormControl
				class="w-24"
				type="number"
				label="Marks"
				min="0"
				step="any"
				:model-value="row.marks"
				:error="errors[index]?.marks"
				@update:model-value="update(index, { marks: String($event ?? '') })"
			/>
			<Button
				variant="ghost"
				icon="lucide-trash-2"
				class="mt-[1.375rem] hover:!bg-surface-red-3 hover:!text-ink-red-7"
				:aria-label="`Remove criterion ${index + 1}`"
				tooltip="Remove"
				@click="rubric = rubric.filter((_, position) => position !== index)"
			/>
		</div>

		<Button
			icon-left="lucide-plus"
			label="Add criterion"
			@click="rubric = [...rubric, { criterion: '', marks: '' }]"
		/>
	</div>
</template>

<script setup lang="ts">
import { Button, FormControl, FormLabel } from 'frappe-ui'
import type { AssignmentDraft } from '@/components/faculty/AssignmentPreview.vue'

type RubricRow = AssignmentDraft['rubric'][number]

defineProps<{ errors: { criterion: string; marks: string }[] }>()

const rubric = defineModel<RubricRow[]>({ required: true })

function update(index: number, change: Partial<RubricRow>) {
	rubric.value = rubric.value.map((row, position) =>
		position === index ? { ...row, ...change } : row,
	)
}
</script>
