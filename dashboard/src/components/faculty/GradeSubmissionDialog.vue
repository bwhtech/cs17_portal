<template>
	<Dialog :open="open" :title="title" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<Select
				v-if="isGradeScale"
				v-model="grade"
				label="Grade"
				placeholder="Select a grade"
				:options="gradeOptions"
			/>
			<FormControl
				v-else
				v-model="marks"
				type="number"
				:label="marksLabel"
				:min="0"
				:max="maxMarks"
				:description="marksGrade"
				:error="fieldError"
				required
			/>

			<FormControl
				v-model="remarks"
				type="textarea"
				label="Remarks"
				description="Optional feedback for the student."
				:rows="3"
			/>

			<div class="space-y-2">
				<PublishFields
					v-model:mode="publishMode"
					v-model:publish-on="publishOn"
					include-draft
					hint="Published grades are visible to the student."
				/>
				<ErrorMessage :message="publishOnError" />
			</div>

			<ErrorMessage v-if="saveError" :message="saveError" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Save grade"
				:loading="save.loading"
				@click="handleSave"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, Select, useCall } from 'frappe-ui'
import PublishFields from '@/components/common/PublishFields.vue'
import { toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { gradeForMarks } from '@/lib/grades'
import { trySubmit } from '@/lib/trySubmit'
import {
	GRADE_SCALE,
	type CS17Submission,
	type EvaluationType,
	type GradeBand,
	type PublishMode,
} from '@/types'

const props = defineProps<{
	open: boolean
	/** The row being graded. Its `grade`, when set, seeds the form. */
	submission: CS17Submission | null
	/** The assignment's `remarks` field: `Grade` scores a letter, `Marks` a number. */
	evaluationType: EvaluationType | ''
	maxMarks?: number
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const isGradeScale = computed(() => props.evaluationType === 'Grade')

const gradeOptions = [
	{ label: 'No grade', value: '' },
	...GRADE_SCALE.map((letter) => ({ label: letter, value: letter })),
]

const grade = ref('')
const marks = ref('')
const remarks = ref('')
const publishMode = ref<PublishMode>('draft')
const publishOn = ref('')
/** Validation, kept under the field it belongs to rather than sent to a toast. */
const fieldError = ref('')
const publishOnError = ref('')
/** Whatever the API answered with. */
const saveError = ref('')

const title = computed(() => `Grade: ${props.submission?.full_name ?? 'Submission'}`)

const marksLabel = computed(() =>
	props.maxMarks == null ? 'Marks' : `Marks (out of ${props.maxMarks})`,
)

const bands = useCall<GradeBand[]>({
	url: '/api/v2/method/cs17_portal.api.get_grade_bands',
	method: 'GET',
	immediate: !isGradeScale.value,
})

const marksGrade = computed(() => {
	const letter = gradeForMarks(bands.data ?? [], marks.value, props.maxMarks)
	return letter ? `Grade ${letter}` : ''
})

const save = useCall<
	{ name: string },
	{
		submission: string
		grade?: string
		marks_obtained?: number
		remarks?: string
		publish: PublishMode
		publish_on: string
	}
>({
	url: '/api/v2/method/cs17_portal.api.grade_submission',
	method: 'POST',
	immediate: false,
})

// A draft grade carries neither flag; a scheduled one carries only
// `published_on`. Those three states are the whole publish ladder.
watch(
	() => props.submission,
	(submission) => {
		const existing = submission?.grade
		grade.value = existing?.grade ?? ''
		marks.value = existing?.marks_obtained == null ? '' : String(existing.marks_obtained)
		remarks.value = existing?.remarks ?? ''
		if (existing?.is_published) {
			publishMode.value = 'now'
			publishOn.value = ''
		} else if (existing?.published_on) {
			publishMode.value = 'schedule'
			publishOn.value = existing.published_on
		} else {
			publishMode.value = 'draft'
			publishOn.value = ''
		}
		fieldError.value = ''
		publishOnError.value = ''
		saveError.value = ''
	},
	{ immediate: true },
)

watch(marks, () => {
	fieldError.value = ''
})

watch([publishMode, publishOn], () => {
	publishOnError.value = ''
})

function validate(): string | null {
	if (!isGradeScale.value) {
		const value = Number(marks.value)
		if (marks.value.trim() === '' || Number.isNaN(value) || value < 0) {
			return 'Please enter valid marks.'
		}
		if (props.maxMarks != null && value > props.maxMarks) {
			return `Marks cannot exceed ${props.maxMarks}.`
		}
	}
	return null
}

async function handleSave() {
	if (!props.submission) return
	saveError.value = ''
	fieldError.value = validate() ?? ''
	publishOnError.value =
		publishMode.value === 'schedule' && !publishOn.value ? 'Pick a publish date.' : ''
	if (fieldError.value || publishOnError.value) return

	await trySubmit(save, {
		submission: props.submission.name,
		grade: isGradeScale.value && grade.value ? grade.value : undefined,
		marks_obtained: isGradeScale.value ? undefined : Number(marks.value),
		remarks: remarks.value.trim() || undefined,
		publish: publishMode.value,
		publish_on: toFrappeDatetime(publishOn.value),
	})

	if (save.error) {
		saveError.value = frappeErrorMessage(save.error, 'Could not save the grade.')
		return
	}
	emit('success')
	emit('update:open', false)
}
</script>
