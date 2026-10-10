<template>
	<!-- Renderless. The confirm itself is `dialog.danger`, mounted imperatively
	     by FrappeUIProvider; this component only owns the call and the open
	     state, so callers keep the same `v-model:open` shape as every other
	     dialog on the page. The root is here because a Vue template needs an
	     element; it never renders. -->
	<span v-if="false" />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { dialog, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{
	open: boolean
	assignment: { name: string; title: string } | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const deleteCall = useCall<null, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.delete_assignment',
	method: 'POST',
	immediate: false,
})

watch(
	() => props.open,
	(open) => {
		const target = props.assignment
		if (!open || !target) return

		dialog.danger({
			title: `Delete "${target.title}"?`,
			message: 'This permanently removes the assignment. This cannot be undone.',
			onConfirm: async () => {
				await trySubmit(deleteCall, { assignment: target.name })
				if (deleteCall.error) {
					throw new Error(
						frappeErrorMessage(deleteCall.error, 'Could not delete the assignment.'),
					)
				}
				toast.success('Assignment deleted')
				emit('success')
			},
			// Fires on cancel, on dismiss and after a successful delete, so it
			// is the one place the open state has to be handed back.
			onCancel: () => emit('update:open', false),
		})
	},
)
</script>
