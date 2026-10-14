<template>
	<div class="min-w-0">
		<p class="mb-1 text-xs text-ink-gray-5">{{ label }}</p>
		<pre
			class="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-2 bg-surface-gray-2 p-2 font-mono text-sm"
			:class="isError ? 'text-ink-red-6' : 'text-ink-gray-8'"
			v-text="text || ' '"
		/>
	</div>
</template>

<script setup lang="ts">
defineProps<{ label: string; text: string; isError?: boolean }>()
</script>
