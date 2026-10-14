<template>
	<Dialog :open="open" title="Students" @update:open="emit('update:open', $event)">
		<MultiSelect
			v-model="picked"
			placeholder="Whole cohort"
			description="Leave empty for the whole cohort."
			:options="options"
			:loading="cohortStudents.loading"
			:hide-search="options.length < 8"
			empty-text="No students in this cohort"
			:error="error || loadError"
		>
			<template #footer />
		</MultiSelect>

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
import { computed, ref, watch } from 'vue'
import { Button, Dialog, MultiSelect, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Student } from '@/types'

const props = defineProps<{
	open: boolean
	assignment: string
	cohort: string
	students: string[]
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()

const picked = ref<Array<string | number>>([...props.students])
const error = ref('')

const cohortStudents = useCall<CS17Student[], { cohort: string }>({
	url: '/api/v2/method/cs17_portal.api.get_cohort_students',
	method: 'GET',
	params: () => ({ cohort: props.cohort }),
})

const save = useCall<null, { assignment: string; students: string[] }>({
	url: '/api/v2/method/cs17_portal.api.set_assignment_students',
	method: 'POST',
	immediate: false,
})

const options = computed(() =>
	(cohortStudents.data ?? []).map((student) => ({
		label: student.full_name,
		value: student.student,
	})),
)

const loadError = computed(() => (cohortStudents.error ? 'Could not load the students.' : ''))

watch(picked, () => {
	error.value = ''
})

async function handleSave() {
	await trySubmit(save, { assignment: props.assignment, students: picked.value.map(String) })
	if (save.error) {
		error.value = frappeErrorMessage(save.error, 'Could not save the students.')
		return
	}
	toast.success('Students saved')
	emit('saved')
	emit('update:open', false)
}
</script>
