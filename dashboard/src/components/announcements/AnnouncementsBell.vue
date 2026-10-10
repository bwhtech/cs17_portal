<template>
	<div class="relative">
		<Popover v-if="isDesktop" v-model:open="open" side="bottom" align="end" :offset="8">
			<template #trigger>
				<Button variant="ghost" icon="lucide-bell" :aria-label="triggerLabel" />
			</template>

			<div class="flex w-96 max-w-[calc(100vw-2rem)] flex-col">
				<ScrollArea class="max-h-96" viewport-class="p-3">
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

		<Badge
			v-if="unread.length"
			class="pointer-events-none absolute -right-1 -top-1"
			theme="red"
			variant="solid"
			size="sm"
			:label="unread.length"
			aria-hidden="true"
		/>

		<BottomSheet v-if="!isDesktop" v-model:open="open">
			<ScrollArea class="max-h-[60vh]" viewport-class="px-4 pb-6">
				<UnreadAnnouncements />
			</ScrollArea>
		</BottomSheet>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge, BottomSheet, Button, Popover, ScrollArea } from 'frappe-ui'
import UnreadAnnouncements from '@/components/announcements/UnreadAnnouncements.vue'
import { useAnnouncements } from '@/composables/useAnnouncements'
import { useBreakpoint } from '@/composables/useBreakpoint'

const { isDesktop } = useBreakpoint()
const { unread } = useAnnouncements()

const open = ref(false)

const triggerLabel = computed(() =>
	unread.value.length ? `Announcements, ${unread.value.length} unread` : 'Announcements',
)
</script>
