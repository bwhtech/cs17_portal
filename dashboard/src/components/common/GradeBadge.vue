<template>
	<Badge :label="label" :theme="graded ? 'green' : 'gray'" variant="subtle" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from 'frappe-ui'

const props = defineProps<{
	graded: boolean
	/** Set on a Marks assignment. */
	marksObtained?: number | null
	/** Set on a Grade assignment. */
	grade?: string | null
	/** The denominator for a Marks assignment. */
	maxMarks?: number
}>()

/**
 * One badge for both evaluation types: a letter stands alone, marks are shown
 * against the total when there is one.
 */
const label = computed(() => {
	if (!props.graded) return 'Not graded'
	if (props.grade) return props.grade
	if (props.marksObtained === null || props.marksObtained === undefined) return 'Graded'
	return props.maxMarks
		? `${props.marksObtained} / ${props.maxMarks}`
		: String(props.marksObtained)
})
</script>
