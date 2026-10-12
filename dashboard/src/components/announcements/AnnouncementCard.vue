<template>
	<div class="flex items-center gap-3 px-4 py-3 sm:gap-4">
		<!-- The variant reads as a colour bar rather than a tinted row: one
		     announcement per line, so the accent has to survive at 4px wide. -->
		<span class="h-8 w-1 shrink-0 rounded-full" :class="barClass" aria-hidden="true" />

		<button
			type="button"
			class="min-w-0 flex-1 rounded-2 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
			@click="emit('open')"
		>
			<span
				class="line-clamp-2 break-words text-base text-ink-gray-8 md:line-clamp-1"
				dir="auto"
				:title="announcement.title"
			>
				{{ announcement.title }}
			</span>
			<span v-if="summary" class="block truncate text-xs text-ink-gray-5" dir="auto">
				{{ summary }}
			</span>
		</button>

		<span v-if="publishedOn" class="shrink-0 text-xs text-ink-gray-5">{{ publishedOn }}</span>

		<div class="flex w-14 shrink-0 justify-end">
			<span v-if="dismissed" class="text-xs text-ink-gray-5">Dismissed</span>
			<Button
				v-else-if="announcement.is_dismissible"
				variant="ghost"
				size="sm"
				icon="lucide-x"
				:aria-label="`Dismiss ${announcement.title}`"
				@click="emit('dismiss')"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import { Button } from 'frappe-ui'
import MarkdownIt from 'markdown-it'
import { formatDate } from '@/lib/dates'
import type { AlertVariant, CS17Announcement } from '@/types'

const props = defineProps<{
	announcement: CS17Announcement
	/** Already dismissed — the row says so instead of offering the action. */
	dismissed?: boolean
}>()

const emit = defineEmits<{ dismiss: []; open: [] }>()

const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true })

const BARS: Record<AlertVariant, string> = {
	info: 'bg-surface-blue-4',
	warning: 'bg-surface-amber-4',
	error: 'bg-surface-red-4',
}

const barClass = computed(() => BARS[props.announcement.alert_variant] ?? BARS.info)
const summary = computed(() =>
	DOMPurify.sanitize(markdown.render(props.announcement.content ?? ''), {
		RETURN_DOM: true,
	}).textContent?.trim(),
)
const publishedOn = computed(() => formatDate(props.announcement.published_date))
</script>
