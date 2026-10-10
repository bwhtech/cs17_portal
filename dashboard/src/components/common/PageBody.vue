<template>
	<div class="px-3 py-5 pb-10 sm:px-5" :class="WIDTHS[width]">
		<slot />
	</div>
</template>

<script setup lang="ts">
const WIDTHS = {
	full: '',
	wide: 'mx-auto max-w-[940px]',
	narrow: 'mx-auto max-w-4xl',
}

withDefaults(defineProps<{ width?: keyof typeof WIDTHS }>(), { width: 'full' })
</script>
