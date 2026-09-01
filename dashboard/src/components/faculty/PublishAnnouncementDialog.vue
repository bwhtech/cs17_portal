<template>
	<Dialog
		:open="open"
		:title="`Publish: ${announcement?.title ?? 'Announcement'}`"
		size="md"
		@update:open="emit('update:open', $event)"
	>
		<template #default>
			<PublishFields
				v-model:mode="mode"
				v-model:publish-on="publishOn"
				hint="Published announcements are visible to students in the cohort."
			/>
			<ErrorMessage class="mt-3" :message="error" />
		</template>

		<template #actions="{ close }">
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="close" />
				<Button
					variant="solid"
					theme="gray"
					label="Save"
					:loading="publishCall.loading"
					@click="publish"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, useCall } from 'frappe-ui'
import PublishFields from '@/components/common/PublishFields.vue'
import { toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { CS17Announcement, PublishMode } from '@/types'

const props = defineProps<{
	open: boolean
	announcement?: CS17Announcement | null
}>()

const emit = defineEmits<{
	'update:open': [value: boolean]
	published: []
}>()

// Publishing never offers "draft" — `PublishFields` drops that option unless
// `include-draft` is set, which is why this dialog starts at "now".
const mode = ref<PublishMode>('now')
const publishOn = ref('')
const error = ref('')

const publishCall = useCall<
	null,
	{ announcement: string; publish: PublishMode; publish_on: string }
>({
	url: '/api/v2/method/cs17_portal.api.publish_announcement',
	method: 'POST',
	immediate: false,
	onError: (err) => {
		error.value = frappeErrorMessage(err, 'Could not publish the announcement.')
	},
})

watch(
	() => props.open,
	(open) => {
		if (!open) return
		mode.value = 'now'
		publishOn.value = ''
		error.value = ''
	},
)

async function publish() {
	if (!props.announcement) return
	if (mode.value === 'schedule' && !publishOn.value) {
		error.value = 'Pick a publish date.'
		return
	}
	error.value = ''

	await publishCall.submit({
		announcement: props.announcement.name,
		publish: mode.value,
		publish_on: toFrappeDatetime(publishOn.value),
	})
	if (publishCall.error) return

	emit('published')
	emit('update:open', false)
}
</script>
