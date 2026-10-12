<template>
	<div v-if="visible.length" class="space-y-2">
		<AnnouncementAlert
			v-for="announcement in visible.slice(0, SHOWN)"
			:key="announcement.name"
			:title="announcement.title"
			:content="announcement.content"
			:variant="announcement.alert_variant"
			:dismissible="Boolean(announcement.is_dismissible)"
			@dismiss="dismiss(announcement.name)"
		/>
		<RouterLink
			v-if="visible.length > SHOWN"
			to="/announcements"
			class="inline-block rounded-2 text-xs text-ink-gray-5 hover:text-ink-gray-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
		>
			{{ visible.length - SHOWN }} more
		</RouterLink>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AnnouncementAlert from '@/components/announcements/AnnouncementAlert.vue'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import type { CS17Announcement } from '@/types'

const props = defineProps<{
	/** Everything in scope; the banner shows only what is still undismissed. */
	announcements: CS17Announcement[]
}>()

const SHOWN = 3

const { dismissed, dismiss } = useAnnouncementDismissals()

// Reads the ref, not `isDismissed`, so a dismissal anywhere in the app (the
// bell, the announcements page) drops the banner here without a reload.
const visible = computed(() => props.announcements.filter((a) => !dismissed.value.has(a.name)))
</script>
