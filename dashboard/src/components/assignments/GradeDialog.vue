<template>
	<Dialog :open="open" title="Grade & Feedback" @update:open="emit('update:open', $event)">
		<div v-if="grade" class="space-y-3">
			<div>
				<p class="text-xs text-ink-gray-5">
					{{ isLetterGrade ? 'Grade' : 'Marks Obtained' }}
				</p>
				<p class="text-2xl text-ink-gray-9">{{ score }}</p>
			</div>
			<div v-if="grade.remarks">
				<p class="text-xs text-ink-gray-5">Remarks</p>
				<p class="mt-0.5 text-p-base text-ink-gray-8">{{ grade.remarks }}</p>
			</div>
		</div>
		<p v-else class="text-p-base text-ink-gray-5">No grade posted yet.</p>
	</Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Dialog } from 'frappe-ui'
import type { CS17Grade } from '@/types'

const props = defineProps<{
	open: boolean
	/** The grade for the assignment the student picked, if one is published. */
	grade?: CS17Grade | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const isLetterGrade = computed(() => props.grade?.evaluation_type === 'Grade')

const score = computed(() => {
	if (!props.grade) return '—'
	const value = isLetterGrade.value ? props.grade.grade : props.grade.marks_obtained
	return value === null || value === undefined ? '—' : String(value)
})
</script>
