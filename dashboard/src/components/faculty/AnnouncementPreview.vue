<template>
	<AnnouncementAlert
		inert
		:title="title?.trim() || placeholder"
		:content="content"
		:variant="variant"
		:dismissible="dismissible"
	/>
</template>

<script setup lang="ts">
import AnnouncementAlert from '@/components/announcements/AnnouncementAlert.vue'
import type { AlertVariant } from '@/types'

withDefaults(
	defineProps<{
		title?: string | null
		content?: string | null
		variant?: AlertVariant | string | null
		/** Draws the dismiss affordance, as a student would see it. */
		dismissible?: boolean
		/** Stand-in heading while the title field is still empty. */
		placeholder?: string
	}>(),
	{ variant: 'info', placeholder: 'Announcement title' },
)
</script>
