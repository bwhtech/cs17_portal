<template>
	<div v-if="!seeded" class="flex gap-3">
		<Skeleton class="h-8 w-36 rounded-2" />
		<Skeleton class="h-8 flex-1 rounded-2" />
		<Skeleton class="h-8 w-28 rounded-2" />
	</div>

	<!-- Two columns on a phone, one row from `md`: the form is pinned to the
	     foot of the workspace, so every line it saves goes to the player. -->
	<form
		v-else
		class="grid grid-cols-2 gap-3 md:flex md:items-end md:gap-4"
		@submit.prevent="save"
	>
		<FormControl
			v-if="showMarks"
			v-model="marks"
			:class="scoreFieldClass"
			type="number"
			label="Marks obtained"
			:placeholder="`0 – ${maxMarks}`"
			:error="marksError"
			min="0"
			:max="maxMarks"
		/>

		<FormControl
			v-if="showGrade"
			v-model="gradeLetter"
			:class="scoreFieldClass"
			type="select"
			label="Grade"
			:options="gradeOptions"
		/>

		<FormControl
			v-model="remarks"
			class="col-span-2 md:flex-1"
			type="textarea"
			label="Remarks"
			:rows="2"
			placeholder="Feedback for the student (Markdown supported)"
		/>

		<Button
			class="col-span-2 w-full md:w-auto"
			variant="solid"
			theme="gray"
			type="submit"
			:loading="saveCall.loading"
			:label="existing.data ? 'Update grade' : 'Save grade'"
		/>
	</form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, FormControl, Skeleton, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { GRADE_SCALE, type EvaluationType } from '@/types'

interface SubmissionGrade {
	name: string
	marks_obtained: number | null
	grade: string | null
	remarks: string | null
}

const props = defineProps<{
	/** `CS17 Assignment Submission` name. */
	submission: string
	maxMarks: number
	/**
	 * The assignment's evaluation type. Unknown (`null`) leaves both fields
	 * on, which is what a Not Graded assignment gets.
	 */
	evaluationType?: EvaluationType | null
}>()

const emit = defineEmits<{ saved: [] }>()

const showMarks = computed(() => props.evaluationType !== 'Grade')
const showGrade = computed(() => props.evaluationType !== 'Marks')

// Marks and grade share the phone's two columns; whichever one shows alone
// takes the full width rather than leaving a hole beside it.
const scoreFieldClass = computed(() =>
	showMarks.value && showGrade.value ? 'md:w-36' : 'col-span-2 md:w-36',
)

const gradeOptions = [
	{ label: 'No grade', value: '' },
	...GRADE_SCALE.map((letter) => ({ label: letter, value: letter })),
]

const marks = ref('')
const gradeLetter = ref('')
const remarks = ref('')
const marksError = ref('')
const seeded = ref(false)

const existing = useCall<SubmissionGrade | null, { submission: string }>({
	url: '/api/v2/method/cs17_portal.api.get_submission_grade',
	method: 'GET',
	params: () => ({ submission: props.submission }),
	refetch: true,
})

// The form is seeded from the saved grade rather than bound to it: a reload
// after saving must not wipe what the grader is still typing.
// `isFinished`, not `data`: an ungraded submission answers with `null`, which
// never changes the data ref and so would never fire a watcher on it.
watch(
	() => existing.isFinished,
	(finished) => {
		if (!finished || seeded.value) return
		const grade = existing.data
		marks.value = grade?.marks_obtained != null ? String(grade.marks_obtained) : ''
		gradeLetter.value = grade?.grade ?? ''
		remarks.value = grade?.remarks ?? ''
		seeded.value = true
	},
	{ immediate: true },
)

const saveCall = useCall<
	SubmissionGrade,
	{
		submission: string
		marks_obtained: number | null
		grade: string | null
		remarks: string | null
	}
>({
	url: '/api/v2/method/cs17_portal.api.save_grade',
	method: 'POST',
	immediate: false,
})

/** `null` for "no marks", a number otherwise — or an error message. */
function readMarks(): { value: number | null } | { error: string } {
	const raw = marks.value.trim()
	if (!showMarks.value || raw === '') return { value: null }
	const value = Number(raw)
	if (Number.isNaN(value)) return { error: 'Marks must be a number.' }
	if (value < 0) return { error: 'Marks cannot be negative.' }
	if (value > props.maxMarks) {
		return { error: `Marks cannot exceed the maximum of ${props.maxMarks}.` }
	}
	return { value }
}

async function save() {
	const parsed = readMarks()
	if ('error' in parsed) {
		marksError.value = parsed.error
		return
	}
	marksError.value = ''

	await saveCall.submit({
		submission: props.submission,
		marks_obtained: parsed.value,
		grade: showGrade.value && gradeLetter.value ? gradeLetter.value : null,
		remarks: remarks.value || null,
	})

	// `submit()` resolves on an API error too, so the error is what tells the
	// two apart.
	if (saveCall.error) {
		toast.error(frappeErrorMessage(saveCall.error, 'Could not save the grade.'))
		return
	}

	toast.success('Grade saved.')
	existing.reload()
	emit('saved')
}
</script>
