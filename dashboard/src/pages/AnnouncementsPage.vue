<template>
	<AppHeader title="Announcements" />

	<div class="px-3 py-5 pb-10 sm:px-5">
		<PageSkeleton v-if="loading" :blocks="2" />

		<EmptyState
			v-else-if="!announcements.length"
			icon="lucide-megaphone"
			title="No announcements"
			description="Anything your cohort is told shows up here."
		/>

		<div
			v-else
			class="divide-y divide-outline-gray-1 overflow-hidden rounded-4 border border-outline-gray-1"
		>
			<AnnouncementCard
				v-for="announcement in announcements"
				:key="announcement.name"
				:announcement="announcement"
				:dismissed="isDismissed(announcement.name)"
				@dismiss="dismiss(announcement.name)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCall } from 'frappe-ui'
import AnnouncementCard from '@/components/announcements/AnnouncementCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import { usePolling, usePublishTimer } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import type { StudentAnnouncementsResponse } from '@/types'

const { cohort } = useSession()
const { dismiss, isDismissed } = useAnnouncementDismissals()

const announcementsCall = useCall<StudentAnnouncementsResponse, { cohort: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_announcements',
	params: () => ({ cohort: cohort.value ?? '' }),
	immediate: Boolean(cohort.value),
})

usePolling(announcementsCall.reload)
usePublishTimer(() => announcementsCall.data?.next_publish_on, announcementsCall.reload)

const announcements = computed(() => announcementsCall.data?.announcements ?? [])
// A student with no cohort never fires the request, so "loading" would hang.
const loading = computed(() => announcementsCall.loading && !announcementsCall.data)
</script>
