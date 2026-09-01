<template>
	<p v-if="!content?.trim()" class="text-p-base text-ink-gray-5">{{ fallback }}</p>
	<!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify above -->
	<div v-else class="cs17-prose" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const props = withDefaults(
	defineProps<{
		/** Markdown source — an assignment description, announcement content. */
		content?: string | null
		/** Shown when there is nothing to render. */
		fallback?: string
	}>(),
	{ fallback: 'No description provided.' },
)

// `html: true` because descriptions written before the Markdown switch contain
// raw HTML; DOMPurify is what makes that safe. `linkify` turns bare URLs in a
// description into links, which is what authors expect from a chat-like field.
const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true })

const html = computed(() => DOMPurify.sanitize(markdown.render(props.content ?? '')))
</script>
