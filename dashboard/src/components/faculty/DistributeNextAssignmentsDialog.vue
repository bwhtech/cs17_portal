<template>
	<Dialog
		:open="open"
		title="Hand out the next ones at random"
		@update:open="emit('update:open', $event)"
	>
		<MultiSelect
			v-model="picked"
			placeholder="Pick students"
			description="Students who submitted what they were given. Each gets one they have not had yet."
			:options="options"
			:loading="finished.loading"
			:hide-search="options.length < 8"
			empty-text="No student has submitted theirs yet"
			:error="error || loadError"
		>
			<template #footer />
		</MultiSelect>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Hand out"
				:disabled="!picked.length"
				:loading="distribute.loading"
				@click="handleSubmit"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, MultiSelect, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Student } from '@/types'

const props = defineProps<{ open: boolean; assignments: string[] }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; done: [] }>()

const picked = ref<Array<string | number>>([])
const error = ref('')

const finished = useCall<CS17Student[], { assignments: string }>({
	url: '/api/v2/method/cs17_portal.api.get_finished_students',
	method: 'GET',
	params: () => ({ assignments: JSON.stringify(props.assignments) }),
})

const distribute = useCall<null, { assignments: string[]; students: string[] }>({
	url: '/api/v2/method/cs17_portal.api.distribute_next_assignments',
	method: 'POST',
	immediate: false,
})

const options = computed(() =>
	(finished.data ?? []).map((student) => ({
		label: student.full_name,
		value: student.student,
	})),
)

const loadError = computed(() => (finished.error ? 'Could not load the students.' : ''))

watch(options, () => {
	picked.value = options.value.map((option) => option.value)
})

watch(picked, () => {
	error.value = ''
})

async function handleSubmit() {
	await trySubmit(distribute, {
		assignments: props.assignments,
		students: picked.value.map(String),
	})
	if (distribute.error) {
		error.value = frappeErrorMessage(distribute.error, 'Could not hand out the assignments.')
		return
	}
	toast.success('Handed out the next assignments at random.')
	emit('done')
	emit('update:open', false)
}
</script>
