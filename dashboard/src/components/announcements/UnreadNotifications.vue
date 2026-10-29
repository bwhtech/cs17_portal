<template>
	<div class="flex h-7 items-center justify-between gap-3">
		<span class="text-base-medium text-ink-gray-8">Notifications</span>
		<Button size="sm" label="Mark all as read" @click="markAllAsRead" />
	</div>

	<List class="mt-1">
		<ListRow
			v-for="notification in unread"
			:key="notification.name"
			:route="{
				name: 'AssignmentDetail',
				params: { assignmentId: notification.document_name },
			}"
			class="py-3"
			@click="markAsRead(notification.name)"
		>
			<ListCell class="self-start">
				<div class="grid size-8 place-items-center rounded-4 bg-surface-gray-2">
					<span class="lucide-clipboard-list size-4 text-ink-gray-6" aria-hidden="true" />
				</div>
			</ListCell>
			<ListCell>
				<div class="min-w-0 flex-1 break-words">
					<p class="text-base-medium text-ink-gray-8" dir="auto">
						{{ notification.subject }}
					</p>
					<time
						class="mt-1 block text-sm text-ink-gray-5"
						:datetime="notification.creation"
					>
						{{ formatDateTime(notification.creation) }}
					</time>
				</div>
			</ListCell>
		</ListRow>
	</List>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import { List, ListCell, ListRow } from 'frappe-ui/list'
import { useNotifications } from '@/composables/useNotifications'
import { formatDateTime } from '@/lib/dates'

const { unread, markAsRead, markAllAsRead } = useNotifications()
</script>
