<template>
	<div class="min-w-0">
		<component
			:is="to ? RouterLink : 'span'"
			:to="to"
			class="block truncate text-base font-normal text-ink-gray-8"
			:class="to && 'hover:underline'"
		>
			{{ title }}
		</component>
		<div v-if="$slots.default" class="mt-1.5 truncate text-sm font-normal text-ink-gray-5">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

// The primary cell of a two-line list row: a title over a meta line. Shared so
// the student and faculty assignment lists cannot drift apart.
defineProps<{
	title: string
	/** Makes the title a link. A row with no destination of its own omits it. */
	to?: string
}>()

defineSlots<{
	/** The meta line under the title. */
	default?: () => unknown
}>()
</script>
