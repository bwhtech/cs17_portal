<template>
	<div class="relative">
		<Popover v-if="isDesktop" v-model:open="open" side="bottom" align="end" :offset="8">
			<template #trigger>
				<Button variant="ghost" icon="lucide-bell" :aria-label="triggerLabel" />
			</template>

			<div class="flex w-80 max-w-[calc(100vw-2rem)] flex-col">
				<div class="flex items-center justify-between px-3 py-2">
					<span class="text-base-medium text-ink-gray-8">Announcements</span>
					<Button
						variant="ghost"
						size="sm"
						icon="lucide-x"
						aria-label="Close announcements"
						@click="open = false"
					/>
				</div>
				<Divider />
				<ScrollArea class="max-h-80" viewport-class="p-2">
					<AlertBanner :announcements="announcements" />
					<p v-if="!unreadCount" class="py-6 text-center text-p-base text-ink-gray-5">
						No announcements
					</p>
				</ScrollArea>
			</div>
		</Popover>

		<Button
			v-else
			variant="ghost"
			icon="lucide-bell"
			:aria-label="triggerLabel"
			@click="open = true"
		/>

		<!-- Outside the trigger so the count never joins the button's own
		     hit area or its accessible name — `triggerLabel` carries it. -->
		<Badge
			v-if="unreadCount"
			class="pointer-events-none absolute -right-1 -top-1"
			theme="red"
			variant="solid"
			size="sm"
			:label="unreadCount"
			aria-hidden="true"
		/>

		<BottomSheet v-if="!isDesktop" v-model:open="open" title="Announcements">
			<ScrollArea class="max-h-[60vh]" viewport-class="px-4 pb-6">
				<AlertBanner :announcements="announcements" />
				<p v-if="!unreadCount" class="py-6 text-center text-p-base text-ink-gray-5">
					No announcements
				</p>
			</ScrollArea>
		</BottomSheet>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge, BottomSheet, Button, Divider, Popover, ScrollArea, useCall } from 'frappe-ui'
import AlertBanner from '@/components/announcements/AlertBanner.vue'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { usePolling } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import type { CS17Announcement, StudentAnnouncementsResponse } from '@/types'

const { isDesktop } = useBreakpoint()
const { cohort, isFaculty } = useSession()
const { dismissed } = useAnnouncementDismissals()

const open = ref(false)

const facultyCall = useCall<CS17Announcement[]>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_announcements',
	immediate: isFaculty.value,
})

const studentCall = useCall<StudentAnnouncementsResponse, { cohort: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_announcements',
	params: () => ({ cohort: cohort.value ?? '' }),
	immediate: !isFaculty.value && Boolean(cohort.value),
})

usePolling(() => (isFaculty.value ? facultyCall.reload() : studentCall.reload()))

const announcements = computed(() =>
	isFaculty.value
		? (facultyCall.data ?? []).filter((announcement) => announcement.is_published)
		: (studentCall.data?.announcements ?? []),
)
const unreadCount = computed(
	() => announcements.value.filter((a) => !dismissed.value.has(a.name)).length,
)

const triggerLabel = computed(() =>
	unreadCount.value ? `Announcements, ${unreadCount.value} unread` : 'Announcements',
)
</script>
