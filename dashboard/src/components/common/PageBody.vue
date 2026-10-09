<template>
	<!-- One place for the page gutters and width, so every screen agrees. -->
	<div class="px-3 py-5 pb-10 sm:px-5" :class="WIDTHS[width]">
		<slot />
	</div>
</template>

<script setup lang="ts">
const WIDTHS = {
	/** Tables that want the room. */
	full: '',
	/** Card grids. */
	wide: 'mx-auto max-w-[940px]',
	/** Dashboards and detail pages. */
	narrow: 'mx-auto max-w-4xl',
}

withDefaults(defineProps<{ width?: keyof typeof WIDTHS }>(), { width: 'full' })
</script>
