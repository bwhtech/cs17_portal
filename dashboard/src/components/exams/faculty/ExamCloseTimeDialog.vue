<template>
	<Dialog :open="open" title="Move close time" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<DateTimePicker
				label="Closes"
				placeholder="Pick a date and time"
				description="Every clock stops at this time, whatever time a student has left."
				required
				:model-value="closesOn"
				:error="error"
				@update:model-value="closesOn = $event ?? ''"
			/>
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Save"
				:loading="save.loading"
				@click="handleSave"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, DateTimePicker, Dialog, toast, useCall } from 'frappe-ui'
import { toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{ open: boolean; exam: string; currentClosesOn: string }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()

const closesOn = ref(props.currentClosesOn)
const error = ref('')

const save = useCall<null, { exam: string; closes_on: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.set_exam_closes_on',
	method: 'POST',
	immediate: false,
})

watch(closesOn, () => {
	error.value = ''
})

async function handleSave() {
	if (!closesOn.value) {
		error.value = 'Pick when it closes.'
		return
	}
	await trySubmit(save, { exam: props.exam, closes_on: toFrappeDatetime(closesOn.value) })
	if (save.error) {
		error.value = frappeErrorMessage(save.error, 'Could not move the close time.')
		return
	}
	toast.success('Close time moved')
	emit('saved')
	emit('update:open', false)
}
</script>
