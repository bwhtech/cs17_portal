<!--
	Renderless. Deleting is a confirmation, not a form, so it goes through
	`dialog.danger` rather than a hand-built `<Dialog>` — but the page still
	drives it with the same `open` / `announcement` pair as the other three
	announcement dialogs, so the call sites stay uniform.
-->
<template><span hidden /></template>

<script setup lang="ts">
import { watch } from 'vue'
import { dialog, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { CS17Announcement } from '@/types'

const props = defineProps<{
	open: boolean
	announcement?: CS17Announcement | null
}>()

const emit = defineEmits<{
	'update:open': [value: boolean]
	deleted: []
}>()

const deleteCall = useCall<null, { announcement: string }>({
	url: '/api/v2/method/cs17_portal.api.delete_announcement',
	method: 'POST',
	immediate: false,
})

watch(
	() => props.open,
	(open) => {
		if (open) confirmDelete()
	},
)

function confirmDelete() {
	const announcement = props.announcement
	if (!announcement) return

	dialog.danger({
		title: `Delete "${announcement.title}"?`,
		message: 'This permanently removes the announcement. This cannot be undone.',
		confirmLabel: 'Delete',
		// A rejected `onConfirm` keeps the dialog open with the message inline,
		// which is exactly the React behaviour: a failed delete stays visible.
		onConfirm: async () => {
			await deleteCall.submit({ announcement: announcement.name })
			if (deleteCall.error) {
				throw new Error(
					frappeErrorMessage(deleteCall.error, 'Could not delete the announcement.'),
				)
			}
			toast.success('Announcement deleted')
			emit('deleted')
			emit('update:open', false)
		},
		onCancel: () => emit('update:open', false),
	})
}
</script>
