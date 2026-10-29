<template>
	<Dialog :open="open" :title="`Copy ${countLabel}`" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<p class="text-p-base text-ink-gray-5">
				Each copy starts as a draft for the whole cohort, with no due date. Pick one, then
				publish.
			</p>
			<FormControl
				v-model="cohort"
				type="select"
				label="Cohort"
				placeholder="Select a cohort"
				:options="cohortOptions"
				:error="cohortError"
				required
			/>
			<FormControl
				v-model="quarter"
				type="select"
				label="Quarter"
				:options="quarterOptions"
			/>
			<ErrorMessage v-if="saveError" :message="saveError" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Copy"
				:loading="copy.loading"
				@click="handleCopy"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, toast, useCall } from 'frappe-ui'
import { useSession } from '@/composables/useSession'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{
	open: boolean
	assignments: string[]
	cohorts: string[]
	quarters: string[]
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; done: [] }>()

const { cohort: facultyCohort } = useSession()

const cohort = ref(facultyCohort.value ?? '')
const quarter = ref('')
const cohortError = ref('')
const saveError = ref('')

const copy = useCall<string[], { assignments: string[]; cohort: string; quarter: string }>({
	url: '/api/v2/method/cs17_portal.api.copy_assignments',
	method: 'POST',
	immediate: false,
})

const countLabel = computed(
	() =>
		`${props.assignments.length} ${props.assignments.length === 1 ? 'assignment' : 'assignments'}`,
)

const cohortOptions = computed(() => props.cohorts.map((name) => ({ label: name, value: name })))

const quarterOptions = computed(() => [
	{ label: 'No quarter', value: '' },
	...props.quarters.map((name) => ({ label: name, value: name })),
])

watch(cohort, () => {
	cohortError.value = ''
})

async function handleCopy() {
	saveError.value = ''
	cohortError.value = cohort.value ? '' : 'Pick the cohort to copy to.'
	if (cohortError.value) return

	const label = countLabel.value
	await trySubmit(copy, {
		assignments: props.assignments,
		cohort: cohort.value,
		quarter: quarter.value,
	})
	if (copy.error) {
		saveError.value = frappeErrorMessage(copy.error, 'Could not copy the assignments.')
		return
	}
	toast.success(`Copied ${label} to ${cohort.value}.`)
	emit('done')
	emit('update:open', false)
}
</script>
