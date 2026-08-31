<template>
	<Dialog :open="open" :title="heading" @update:open="emit('update:open', $event)">
		<template #default>
			<div v-if="succeeded" class="text-p-base text-ink-gray-7">
				Your project was submitted to {{ target?.title }}.
			</div>

			<div v-else-if="target" class="space-y-3">
				<p class="text-p-base text-ink-gray-7">
					It will be submitted to {{ target.title }}. Your current project is snapshotted;
					you can revise it until the deadline.
				</p>
				<ErrorMessage :message="error" />
			</div>

			<div v-else class="space-y-3">
				<p class="text-p-base text-ink-gray-7">
					Pick a Scratch assignment to submit this project to.
				</p>

				<div v-if="assignments.loading" class="space-y-2">
					<Skeleton v-for="n in 2" :key="n" class="h-7 rounded-4" />
				</div>
				<p v-else-if="!options.length" class="text-p-sm text-ink-gray-5">
					No open Scratch assignments in your cohort.
				</p>
				<div v-else class="space-y-2">
					<Button
						v-for="assignment in options"
						:key="assignment.name"
						class="w-full !justify-start"
						variant="outline"
						@click="chosen = assignment"
					>
						<span class="truncate">{{ assignment.title }}</span>
					</Button>
				</div>
			</div>
		</template>

		<template #actions>
			<div class="flex justify-end gap-2">
				<template v-if="succeeded">
					<Button label="Close" @click="emit('update:open', false)" />
					<Button
						variant="solid"
						theme="gray"
						label="Go to Dashboard"
						route="/"
						@click="emit('update:open', false)"
					/>
				</template>
				<template v-else-if="target">
					<Button label="Cancel" :disabled="submitting" @click="cancelConfirm" />
					<Button
						variant="solid"
						theme="gray"
						label="Submit"
						:loading="submitting"
						@click="confirmSubmit"
					/>
				</template>
				<Button v-else label="Cancel" @click="emit('update:open', false)" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, Skeleton, useCall, useList } from 'frappe-ui'
import { useSession } from '@/composables/useSession'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { CS17Assignment } from '@/types'

const props = defineProps<{
	open: boolean
	/** The `CS17 Project` being submitted. */
	project: string
	/** From `?assignment=` — skips the picker when it names a listed assignment. */
	presetAssignment?: string | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { cohort } = useSession()

// Only the student's own cohort has assignments they can submit to, so the
// list waits for the dialog rather than loading with every editor page.
const assignments = useList<CS17Assignment>({
	doctype: 'CS17 Assignment',
	fields: ['name', 'title'],
	filters: () => ({
		cohort: cohort.value ?? '',
		submission_type: 'Scratch',
		is_published: 1,
	}),
	orderBy: 'due_date asc',
	limit: 100,
	immediate: false,
})

const submitProject = useCall<{ name: string }, { assignment: string; project: string }>({
	url: '/api/v2/method/cs17_portal.api.submit_scratch_project',
	method: 'POST',
	immediate: false,
})

const chosen = ref<CS17Assignment | null>(null)
const succeeded = ref(false)
const error = ref('')
const submitting = computed(() => submitProject.loading)

const options = computed(() => assignments.data ?? [])

const preset = computed(
	() => options.value.find((assignment) => assignment.name === props.presetAssignment) ?? null,
)
const target = computed(() => chosen.value ?? preset.value)

const heading = computed(() => {
	if (succeeded.value) return 'Submission successful'
	if (target.value) return 'Submit this project?'
	return 'Submit to an assignment'
})

watch(
	() => props.open,
	(open) => {
		if (!open) return
		chosen.value = null
		succeeded.value = false
		error.value = ''
		if (cohort.value) assignments.reload()
	},
)

/** Cancel steps back to the picker when the student got there by choosing. */
function cancelConfirm() {
	if (chosen.value) {
		chosen.value = null
		error.value = ''
		return
	}
	emit('update:open', false)
}

async function confirmSubmit() {
	if (!target.value) return
	error.value = ''
	const submitted = await submitProject.submit({
		assignment: target.value.name,
		project: props.project,
	})
	// `submit()` resolves rather than throwing, and keeps the last good
	// response in `data` — so the error is what says whether this call landed.
	if (submitProject.error || !submitted) {
		error.value = frappeErrorMessage(submitProject.error, 'Could not submit the project.')
		return
	}
	succeeded.value = true
}
</script>
