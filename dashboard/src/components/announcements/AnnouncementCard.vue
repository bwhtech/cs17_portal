<template>
	<div class="flex items-center gap-3 px-4 py-3 sm:gap-4">
		<!-- The variant reads as a colour bar rather than a tinted row: one
		     announcement per line, so the accent has to survive at 4px wide. -->
		<span class="h-8 w-1 shrink-0 rounded-full" :class="barClass" aria-hidden="true" />

		<div class="min-w-0 flex-1">
			<p class="truncate text-base text-ink-gray-8">{{ announcement.title }}</p>
			<p v-if="announcement.content" class="truncate text-xs text-ink-gray-5">
				{{ announcement.content }}
			</p>
		</div>

		<span v-if="publishedOn" class="shrink-0 text-xs text-ink-gray-5">{{ publishedOn }}</span>

		<span v-if="dismissed" class="shrink-0 text-xs text-ink-gray-5">Dismissed</span>
		<Button
			v-else
			variant="ghost"
			size="sm"
			icon="lucide-x"
			class="shrink-0"
			:aria-label="`Dismiss ${announcement.title}`"
			@click="emit('dismiss')"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import { formatDate } from '@/lib/dates'
import type { AlertVariant, CS17Announcement } from '@/types'

const props = defineProps<{
	announcement: CS17Announcement
	/** Already dismissed — the row says so instead of offering the action. */
	dismissed?: boolean
}>()

const emit = defineEmits<{ dismiss: [] }>()

const BARS: Record<AlertVariant, string> = {
	info: 'bg-surface-blue-4',
	warning: 'bg-surface-amber-4',
	error: 'bg-surface-red-4',
}

const barClass = computed(() => BARS[props.announcement.alert_variant] ?? BARS.info)
const publishedOn = computed(() => formatDate(props.announcement.published_date))
</script>
