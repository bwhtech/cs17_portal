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
import { Badge, BottomSheet, Button, Divider, Popover, ScrollArea, useList } from 'frappe-ui'
import AlertBanner from '@/components/announcements/AlertBanner.vue'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { usePolling } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import type { CS17Announcement } from '@/types'

const { isDesktop } = useBreakpoint()
const { cohort, isFaculty } = useSession()
const { dismissed } = useAnnouncementDismissals()

const open = ref(false)

/**
 * Faculty see every published announcement; a student sees their cohort's.
 * One component, the filter comes from the session — the React app kept two
 * near-identical top bars to say the same thing.
 */
const list = useList<CS17Announcement>({
	doctype: 'CS17 Announcement',
	fields: ['name', 'title', 'content', 'alert_variant', 'is_dismissible'],
	filters: () =>
		isFaculty.value ? { is_published: 1 } : { is_published: 1, cohort: cohort.value ?? '' },
	orderBy: 'creation desc',
	limit: 50,
	immediate: isFaculty.value || Boolean(cohort.value),
})

// A scheduled publish should reach the bell without a reload, as it did under
// SWR's refreshInterval. There is no `next_publish_on` on a doc list, so the
// interval is all there is here.
usePolling(list.reload)

const announcements = computed(() => list.data ?? [])
const unreadCount = computed(
	() => announcements.value.filter((a) => !dismissed.value.has(a.name)).length,
)

const triggerLabel = computed(() =>
	unreadCount.value ? `Announcements, ${unreadCount.value} unread` : 'Announcements',
)
</script>
