<template>
	<Badge :label="label" :theme="graded ? 'green' : 'gray'" variant="subtle" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import { formatGrade } from '@/lib/grades'
import type { EvaluationType } from '@/types'

const props = defineProps<{
	graded: boolean
	evaluationType?: EvaluationType | null
	/** Set on a Marks assignment. */
	marksObtained?: number | null
	grade?: string | null
	/** The denominator for a Marks assignment. */
	maxMarks?: number
}>()

const label = computed(() => (props.graded ? formatGrade(props) : 'Not graded'))
</script>
