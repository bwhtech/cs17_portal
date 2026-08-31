<template>
	<div v-if="visible.length" class="space-y-2">
		<Alert
			v-for="announcement in visible"
			:key="announcement.name"
			:title="announcement.title"
			:theme="THEMES[announcement.alert_variant] ?? 'blue'"
			:dismissible="Boolean(announcement.is_dismissible)"
			@dismiss="dismiss(announcement.name)"
		>
			<template v-if="announcement.content?.trim()" #description>
				<MarkdownText :content="announcement.content" />
			</template>
		</Alert>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Alert } from 'frappe-ui'
import MarkdownText from '@/components/common/MarkdownText.vue'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import type { AlertVariant, CS17Announcement } from '@/types'

const props = defineProps<{
	/** Everything in scope; the banner shows only what is still undismissed. */
	announcements: CS17Announcement[]
}>()

/**
 * The variant ladder as frappe-ui reads it. The container stays neutral and
 * the theme colours the status glyph — the Frappe language, in place of the
 * React banner's fully tinted card.
 */
const THEMES: Record<AlertVariant, 'blue' | 'amber' | 'red'> = {
	info: 'blue',
	warning: 'amber',
	error: 'red',
}

const { dismissed, dismiss } = useAnnouncementDismissals()

// Reads the ref, not `isDismissed`, so a dismissal anywhere in the app (the
// bell, the announcements page) drops the banner here without a reload.
const visible = computed(() => props.announcements.filter((a) => !dismissed.value.has(a.name)))
</script>
