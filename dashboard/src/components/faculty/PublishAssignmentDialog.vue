<template>
	<Dialog
		:open="open"
		:title="`Publish: ${assignment?.title ?? 'Assignment'}`"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<PublishFields
				v-model:mode="mode"
				v-model:publish-on="publishOn"
				hint="Published assignments are visible to students in the cohort."
			/>
			<ErrorMessage :message="error" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Save"
				:loading="publishCall.loading"
				@click="handlePublish"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, toast, useCall } from 'frappe-ui'
import PublishFields from '@/components/common/PublishFields.vue'
import { toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { PublishMode } from '@/types'

const props = defineProps<{
	open: boolean
	assignment: { name: string; title: string } | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const mode = ref<PublishMode>('now')
const publishOn = ref('')
const error = ref('')

const publishCall = useCall<null, { assignment: string; publish: string; publish_on: string }>({
	url: '/api/v2/method/cs17_portal.api.publish_assignment',
	method: 'POST',
	immediate: false,
})

// A reschedule opens the same dialog against a different assignment, so the
// form starts over whenever the target changes rather than only on mount.
watch(
	() => props.assignment,
	() => {
		mode.value = 'now'
		publishOn.value = ''
		error.value = ''
	},
)

watch([mode, publishOn], () => {
	error.value = ''
})

async function handlePublish() {
	const target = props.assignment
	if (!target) return
	if (mode.value === 'schedule' && !publishOn.value) {
		error.value = 'Pick a publish date.'
		return
	}

	await publishCall.submit({
		assignment: target.name,
		publish: mode.value,
		publish_on: toFrappeDatetime(publishOn.value),
	})
	if (publishCall.error) {
		error.value = frappeErrorMessage(publishCall.error, 'Could not publish the assignment.')
		return
	}

	toast.success(mode.value === 'schedule' ? 'Assignment scheduled' : 'Assignment published')
	emit('success')
	emit('update:open', false)
}
</script>
