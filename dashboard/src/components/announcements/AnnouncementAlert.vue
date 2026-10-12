<template>
	<Alert
		class="break-words [&[data-layout=row]]:h-auto [&[data-layout=row]]:min-h-10 [&_[data-slot=description]]:w-full [&_[data-slot=title]]:whitespace-normal"
		:theme="THEMES[variant as AlertVariant] ?? 'blue'"
		:dismissible="dismissible"
		@dismiss="emit('dismiss')"
	>
		<template #title>
			<span dir="auto">{{ title }}</span>
		</template>
		<template v-if="content?.trim()" #description>
			<MarkdownText :content="content" />
		</template>
	</Alert>
</template>

<script setup lang="ts">
import { Alert } from 'frappe-ui'
import MarkdownText from '@/components/common/MarkdownText.vue'
import type { AlertVariant } from '@/types'

defineProps<{
	title: string
	content?: string | null
	variant?: AlertVariant | string | null
	dismissible?: boolean
}>()

const emit = defineEmits<{ dismiss: [] }>()

const THEMES: Record<AlertVariant, 'blue' | 'amber' | 'red'> = {
	info: 'blue',
	warning: 'amber',
	error: 'red',
}
</script>
