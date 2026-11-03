<template>
	<div
		class="grid grid-cols-2 items-end gap-3 md:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] md:gap-4"
	>
		<FormControl
			v-for="(row, index) in rubric"
			:key="index"
			type="number"
			:label="`${row.criterion}, out\u00a0of\u00a0${row.marks}`"
			:model-value="marks[index]"
			:error="errors[index]"
			min="0"
			:max="row.marks"
			step="any"
			@update:model-value="update(index, String($event ?? ''))"
		/>
		<p class="col-span-full text-p-sm text-ink-gray-7">
			Total {{ rubricTotal(marks) }} of {{ rubricTotal(rubric.map((row) => row.marks)) }}
			<template v-if="grade">· {{ grade }}</template>
		</p>
	</div>
</template>

<script setup lang="ts">
import { FormControl } from 'frappe-ui'
import { rubricTotal, type RubricCriterion } from '@/lib/rubric'

const props = defineProps<{
	rubric: RubricCriterion[]
	errors: string[]
	grade?: string
}>()

const marks = defineModel<string[]>({ required: true })

function update(index: number, value: string) {
	marks.value = props.rubric.map((_, position) =>
		position === index ? value : (marks.value[position] ?? ''),
	)
}
</script>
