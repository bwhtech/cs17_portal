<template>
	<div class="flex h-7 items-center justify-between gap-3">
		<span class="text-base-medium text-ink-gray-8">Announcements</span>
		<Button v-if="dismissible.length" size="sm" label="Mark all as read" @click="dismissAll" />
	</div>

	<List v-if="unread.length" class="mt-1">
		<ListRow v-for="announcement in unread" :key="announcement.name" class="py-3">
			<ListCell class="self-start">
				<div class="grid size-8 place-items-center rounded-4 bg-surface-gray-2">
					<span
						:class="[ICONS[announcement.alert_variant] ?? ICONS.info, 'size-4']"
						aria-hidden="true"
					/>
				</div>
			</ListCell>
			<ListCell>
				<div class="min-w-0 flex-1">
					<p class="text-base-medium text-ink-gray-8">{{ announcement.title }}</p>
					<MarkdownText
						v-if="announcement.content?.trim()"
						class="mt-1 text-p-sm text-ink-gray-6"
						:content="announcement.content"
					/>
					<time
						v-if="announcement.published_date"
						class="mt-1 block text-sm text-ink-gray-5"
						:datetime="announcement.published_date"
					>
						{{ formatDate(announcement.published_date) }}
					</time>
				</div>
			</ListCell>
			<ListCell v-if="announcement.is_dismissible" class="-mt-1 self-start">
				<Button
					variant="ghost"
					icon="lucide-check"
					tooltip="Mark as read"
					:aria-label="`Mark ${announcement.title} as read`"
					@click="dismiss(announcement.name)"
				/>
			</ListCell>
		</ListRow>
	</List>

	<EmptyState v-else class="!py-8" icon="lucide-bell-check" title="No unread announcements" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import { List, ListCell, ListRow } from 'frappe-ui/list'
import EmptyState from '@/components/common/EmptyState.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import { useAnnouncements } from '@/composables/useAnnouncements'
import { formatDate } from '@/lib/dates'
import type { AlertVariant } from '@/types'

const ICONS: Record<AlertVariant, string> = {
	info: 'lucide-info text-ink-blue-7',
	warning: 'lucide-triangle-alert text-ink-amber-7',
	error: 'lucide-circle-alert text-ink-red-7',
}

const { unread } = useAnnouncements()
const { dismiss } = useAnnouncementDismissals()

const dismissible = computed(() => unread.value.filter((a) => a.is_dismissible))

function dismissAll() {
	dismissible.value.forEach((a) => dismiss(a.name))
}
</script>
