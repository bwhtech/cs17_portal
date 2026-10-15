<template>
	<Dialog :open="open" title="Timing" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<DateTimePicker
				label="Due Date"
				placeholder="Pick a date and time"
				:model-value="dueDate"
				@update:model-value="dueDate = $event ?? ''"
			/>
			<FormControl
				v-if="assignment.submission_type === 'Python'"
				v-model="timeLimit"
				type="number"
				label="Time limit (minutes)"
				description="Leave empty for no limit. A student with the question open gets the new time within a minute."
				min="1"
				step="1"
			/>
			<FormControl
				v-if="assignment.submission_type === 'Python' && timeLimit"
				v-model="attemptsAllowed"
				type="number"
				label="Attempts allowed"
				description="How many times a student can start the clock. Leave empty for one."
				min="1"
				step="1"
			/>
			<ErrorMessage :message="error" />
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
import {
	Button,
	DateTimePicker,
	Dialog,
	ErrorMessage,
	FormControl,
	toast,
	useCall,
} from 'frappe-ui'
import { toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Assignment } from '@/types'

const props = defineProps<{ open: boolean; assignment: CS17Assignment }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()

const dueDate = ref(props.assignment.due_date ?? '')
const timeLimit = ref(props.assignment.time_limit ? String(props.assignment.time_limit) : '')
const attemptsAllowed = ref(
	props.assignment.attempts_allowed ? String(props.assignment.attempts_allowed) : '',
)
const error = ref('')

const save = useCall<
	null,
	{ assignment: string; due_date: string; time_limit: number; attempts_allowed: number }
>({
	url: '/api/v2/method/cs17_portal.api.set_assignment_timing',
	method: 'POST',
	immediate: false,
})

watch([dueDate, timeLimit, attemptsAllowed], () => {
	error.value = ''
})

async function handleSave() {
	await trySubmit(save, {
		assignment: props.assignment.name,
		due_date: toFrappeDatetime(dueDate.value),
		time_limit: Number(timeLimit.value) || 0,
		attempts_allowed: Number(attemptsAllowed.value) || 0,
	})
	if (save.error) {
		error.value = frappeErrorMessage(save.error, 'Could not save the timing.')
		return
	}
	toast.success('Timing saved')
	emit('saved')
	emit('update:open', false)
}
</script>
