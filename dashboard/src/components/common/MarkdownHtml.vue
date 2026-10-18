<template>
	<!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify above -->
	<div class="cs17-prose" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const props = defineProps<{ content: string }>()

// `html: true` because descriptions written before the Markdown switch contain
// raw HTML; DOMPurify is what makes that safe. `linkify` turns bare URLs in a
// description into links, which is what authors expect from a chat-like field.
const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true })

const html = computed(() => DOMPurify.sanitize(markdown.render(props.content)))
</script>
