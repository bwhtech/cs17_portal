<template>
	<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
		<div class="rounded-full bg-surface-gray-2 p-3 text-ink-gray-5">
			<span :class="[icon, 'size-6']" aria-hidden="true" />
		</div>
		<p class="text-base text-ink-gray-7">{{ title }}</p>
		<p v-if="description" class="text-sm text-ink-gray-5">{{ description }}</p>
		<div v-if="$slots.action" class="mt-2">
			<slot name="action" />
		</div>
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		title: string
		description?: string
		/** A lucide class, e.g. `lucide-inbox`. */
		icon?: string
	}>(),
	{ icon: 'lucide-inbox' },
)

defineSlots<{
	/** The one action that resolves the empty state, usually a `Button`. */
	action?: () => unknown
}>()
</script>
