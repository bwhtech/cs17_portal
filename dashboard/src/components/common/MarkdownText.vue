<template>
	<p v-if="!content?.trim()" class="text-p-base text-ink-gray-5">{{ fallback }}</p>
	<MarkdownHtml v-else :content="content" />
</template>

<script lang="ts">
import { defineAsyncComponent, h } from 'vue'

const MarkdownHtml = defineAsyncComponent({
	loader: () => import('./MarkdownHtml.vue'),
	loadingComponent: (props: { content: string }) =>
		h(
			'div',
			{ class: 'cs17-prose invisible whitespace-pre-line' },
			props.content.replace(/\n\s*\n/g, '\n'),
		),
	delay: 0,
})
</script>

<script setup lang="ts">
withDefaults(
	defineProps<{
		/** Markdown source — an assignment description, announcement content. */
		content?: string | null
		/** Shown when there is nothing to render. */
		fallback?: string
	}>(),
	{ fallback: 'No description provided.' },
)
</script>
