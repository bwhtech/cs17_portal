<template>
	<AppHeader title="Announcements" />

	<PageBody width="narrow">
		<LoadError
			v-if="failed"
			title="Could not load announcements"
			:loading="announcementsCall.loading"
			@retry="announcementsCall.reload()"
		/>

		<PageSkeleton v-else-if="loading" :blocks="2" />

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
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCall } from 'frappe-ui'
import AnnouncementCard from '@/components/announcements/AnnouncementCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolling, usePublishTimer } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import type { StudentAnnouncementsResponse } from '@/types'

const { isStudent } = useSession()
const { dismiss, isDismissed } = useAnnouncementDismissals()

const announcementsCall = useCall<StudentAnnouncementsResponse>({
	url: '/api/v2/method/cs17_portal.api.get_student_announcements',
	immediate: isStudent.value,
})

usePolling(announcementsCall.reload)
usePublishTimer(() => announcementsCall.data?.next_publish_on, announcementsCall.reload)

const announcements = computed(() => announcementsCall.data?.announcements ?? [])
// A user who is not a student never fires the request, so "loading" would hang.
const loading = computed(() => announcementsCall.loading && !announcementsCall.data)
const failed = useLoadFailed(announcementsCall)
</script>
