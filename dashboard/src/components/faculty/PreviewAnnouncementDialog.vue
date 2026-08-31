<template>
	<Dialog
		:open="open"
		title="Preview"
		message="How students will see this announcement."
		size="xl"
		@update:open="emit('update:open', $event)"
	>
		<AnnouncementPreview
			v-if="announcement"
			:title="announcement.title"
			:content="announcement.content"
			:variant="announcement.alert_variant"
			:dismissible="Boolean(announcement.is_dismissible)"
		/>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import AnnouncementPreview from '@/components/faculty/AnnouncementPreview.vue'
import type { CS17Announcement } from '@/types'

defineProps<{
	open: boolean
	announcement?: CS17Announcement | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>
