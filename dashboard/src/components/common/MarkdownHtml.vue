<template>
	<!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify above -->
	<div class="cs17-prose" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import { unescapeTags } from '@/lib/markdown'

const props = defineProps<{ content: string }>()

// `html: true` because descriptions written before the Markdown switch contain
// raw HTML; DOMPurify is what makes that safe. `linkify` turns bare URLs in a
// description into links, which is what authors expect from a chat-like field.
const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true })
markdown.core.ruler.push('unescape_tags_in_code', (state) => {
	for (const token of state.tokens.flatMap((token) => [token, ...(token.children ?? [])])) {
		if (['code_inline', 'code_block', 'fence'].includes(token.type)) {
			token.content = unescapeTags(token.content)
		}
	}
})

const html = computed(() => DOMPurify.sanitize(markdown.render(props.content)))
</script>
