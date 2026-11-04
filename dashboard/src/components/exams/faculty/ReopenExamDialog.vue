<template>
	<Dialog :open="open" title="Reopen exam" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<p class="break-words text-p-base text-ink-gray-7">
				{{ studentName }} gets back the time they had left when they finished. Questions
				that finishing submitted open again.
			</p>
			<FormControl
				v-model="minutes"
				type="number"
				label="Extra minutes"
				min="0"
				step="1"
				description="Added to the time they had left."
				:error="minutesError"
			/>
			<ErrorMessage :message="error" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Reopen exam"
				:loading="reopenExam.loading"
				@click="handleSave"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, toast, useCall } from 'frappe-ui'
import type { ExamStudent } from '@/components/exams/faculty/codingExam'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{ open: boolean; exam: string; student: ExamStudent }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()

const minutes = ref('0')
const minutesError = ref('')
const error = ref('')

const studentName = computed(() => props.student.full_name ?? props.student.student)

const reopenExam = useCall<null, { exam: string; student: string; minutes: number }>({
	url: '/api/v2/method/cs17_portal.coding_exam.reopen_coding_exam',
	method: 'POST',
	immediate: false,
})

watch(minutes, () => {
	minutesError.value = ''
	error.value = ''
})

async function handleSave() {
	const added = Number(minutes.value)
	if (!Number.isInteger(added) || added < 0) {
		minutesError.value = 'Enter 0 or more whole minutes.'
		return
	}
	await trySubmit(reopenExam, {
		exam: props.exam,
		student: props.student.student,
		minutes: added,
	})
	if (reopenExam.error) {
		error.value = frappeErrorMessage(reopenExam.error, 'Could not reopen the exam.')
		return
	}
	toast.success(`Reopened the exam for ${studentName.value}`)
	emit('saved')
	emit('update:open', false)
}
</script>
