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
				@open="opened = announcement"
			/>
		</div>
	</PageBody>

	<Dialog
		:open="Boolean(opened)"
		size="xl"
		@update:open="(open: boolean) => open || (opened = null)"
	>
		<template #title>
			<h3 class="text-2xl-semibold leading-6 text-ink-gray-8" dir="auto">
				{{ opened?.title }}
			</h3>
		</template>

		<template #default>
			<div class="space-y-2 break-words">
				<time
					v-if="opened?.published_date"
					class="block text-sm text-ink-gray-5"
					:datetime="opened.published_date"
				>
					{{ formatDate(opened.published_date) }}
				</time>
				<MarkdownText v-if="opened?.content?.trim()" :content="opened.content" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Dialog, useCall } from 'frappe-ui'
import AnnouncementCard from '@/components/announcements/AnnouncementCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolling, usePublishTimer } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import { formatDate } from '@/lib/dates'
import type { CS17Announcement, StudentAnnouncementsResponse } from '@/types'

const { isStudent } = useSession()
const { dismiss, isDismissed } = useAnnouncementDismissals()

const opened = ref<CS17Announcement | null>(null)

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
