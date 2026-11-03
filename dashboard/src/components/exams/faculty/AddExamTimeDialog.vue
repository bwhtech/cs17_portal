<template>
	<Dialog :open="open" title="Add time" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<FormControl
				v-model="minutes"
				type="number"
				label="Minutes"
				min="1"
				step="1"
				required
				autofocus
				:error="minutesError"
			/>
			<FormControl
				v-model="student"
				type="select"
				label="For"
				description="Students see the new time within a few seconds."
				:options="studentOptions"
			/>
			<ErrorMessage :message="error" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Add time"
				:loading="addTime.loading"
				@click="handleSave"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, toast, useCall } from 'frappe-ui'
import { formatMinutes, type ExamStudent } from '@/components/exams/faculty/codingExam'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const EVERYONE = ''

const props = defineProps<{
	open: boolean
	exam: string
	students: ExamStudent[]
	initialStudent?: string | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()

const minutes = ref('10')
const student = ref(props.initialStudent ?? EVERYONE)
const minutesError = ref('')
const error = ref('')

const studentOptions = computed(() => [
	{ label: 'Everyone', value: EVERYONE },
	...props.students.map((row) => ({ label: row.full_name ?? row.student, value: row.student })),
])

const addTime = useCall<null, { exam: string; minutes: number; student?: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.add_exam_time',
	method: 'POST',
	immediate: false,
})

watch([minutes, student], () => {
	minutesError.value = ''
	error.value = ''
})

async function handleSave() {
	const added = Number(minutes.value)
	if (!Number.isInteger(added) || added < 1) {
		minutesError.value = 'Add at least 1 whole minute.'
		return
	}
	await trySubmit(addTime, {
		exam: props.exam,
		minutes: added,
		...(student.value ? { student: student.value } : {}),
	})
	if (addTime.error) {
		error.value = frappeErrorMessage(addTime.error, 'Could not add the time.')
		return
	}
	const label = studentOptions.value.find((option) => option.value === student.value)?.label
	toast.success(`Added ${formatMinutes(added)} for ${student.value ? label : 'everyone'}`)
	emit('saved')
	emit('update:open', false)
}
</script>
