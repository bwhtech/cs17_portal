<template>
	<div class="relative">
		<Popover v-if="isDesktop" v-model:open="open" side="bottom" align="end" :offset="8">
			<template #trigger>
				<Button variant="ghost" icon="lucide-bell" :aria-label="triggerLabel" />
			</template>

			<div class="flex w-96 max-w-[calc(100vw-2rem)] flex-col">
				<ScrollArea class="max-h-96" viewport-class="p-3">
					<div v-if="notifications.length" class="mb-4"><UnreadNotifications /></div>
					<UnreadAnnouncements />
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

		<span
			v-if="unreadCount"
			class="pointer-events-none absolute right-1 top-1 size-2 rounded-full border border-[var(--surface-base)] bg-surface-red-6"
			aria-hidden="true"
		/>

		<BottomSheet v-if="!isDesktop" v-model:open="open">
			<ScrollArea class="max-h-[60vh]" viewport-class="px-4 pb-6">
				<div v-if="notifications.length" class="mb-4"><UnreadNotifications /></div>
				<UnreadAnnouncements />
			</ScrollArea>
		</BottomSheet>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BottomSheet, Button, Popover, ScrollArea } from 'frappe-ui'
import UnreadAnnouncements from '@/components/announcements/UnreadAnnouncements.vue'
import UnreadNotifications from '@/components/announcements/UnreadNotifications.vue'
import { useAnnouncements } from '@/composables/useAnnouncements'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useNotifications } from '@/composables/useNotifications'

const { isDesktop } = useBreakpoint()
const { unread } = useAnnouncements()
const { unread: notifications } = useNotifications()

const open = ref(false)

const unreadCount = computed(() => unread.value.length + notifications.value.length)

const triggerLabel = computed(() =>
	unreadCount.value ? `Notifications, ${unreadCount.value} unread` : 'Notifications',
)
</script>
