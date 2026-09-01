<template>
	<div
		class="flex flex-col gap-3 rounded-4 border border-outline-gray-1 bg-surface-gray-1 px-4 py-3 sm:flex-row sm:items-end"
	>
		<p class="text-base font-medium text-ink-gray-7 sm:pb-2">
			{{ submissions.length }} selected
		</p>

		<div class="sm:w-56">
			<FacultySelect
				v-model="assignTo"
				label="Assign selected to"
				placeholder="Pick a faculty member"
				:error="fieldError"
			/>
		</div>

		<Button
			class="sm:mb-0.5"
			variant="solid"
			theme="gray"
			label="Assign"
			:loading="assign.loading"
			@click="handleAssign"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, toast, useCall } from 'frappe-ui'
import FacultySelect from '@/components/faculty/FacultySelect.vue'
import { frappeErrorMessage } from '@/lib/frappeError'

const props = defineProps<{
	/** The selected submission names. */
	submissions: string[]
}>()

const emit = defineEmits<{ done: [] }>()

const assignTo = ref('')
const fieldError = ref('')

const assign = useCall<null, { submissions: string[]; assign_to: string }>({
	url: '/api/v2/method/cs17_portal.api.assign_submissions',
	method: 'POST',
	immediate: false,
})

watch(assignTo, () => {
	fieldError.value = ''
})

async function handleAssign() {
	if (!assignTo.value) {
		fieldError.value = 'Pick a faculty member.'
		return
	}

	await assign.submit({ submissions: props.submissions, assign_to: assignTo.value })
	if (assign.error) {
		toast.error(frappeErrorMessage(assign.error, 'Could not assign the submissions.'))
		return
	}
	toast.success(`Assigned ${props.submissions.length} submissions.`)
	assignTo.value = ''
	emit('done')
}
</script>
