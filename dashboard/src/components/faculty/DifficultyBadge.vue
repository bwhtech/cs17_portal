<template>
	<Badge :label="difficulty" :theme="THEMES[difficulty]" variant="subtle" />
</template>

<script setup lang="ts">
import { Badge, type BadgeProps } from 'frappe-ui'
import type { Difficulty } from '@/types'

defineProps<{ difficulty: Difficulty }>()

const THEMES: Record<Difficulty, BadgeProps['theme']> = {
	Easy: 'green',
	Medium: 'amber',
	Hard: 'red',
	'Extra hard': 'violet',
}
</script>
