<template>
	<p v-if="!seeded && isRefusal(existing.error)" class="text-p-base text-ink-gray-5">
		{{ frappeErrorMessage(existing.error, 'Could not load the grade.') }}
	</p>

	<div v-else-if="!seeded && !failed" class="flex gap-3">
		<Skeleton class="h-8 w-36 rounded-2" />
		<Skeleton class="h-8 flex-1 rounded-2" />
		<Skeleton class="h-8 w-28 rounded-2" />
	</div>

	<LoadError
		v-else-if="!seeded"
		class="!py-0"
		title="Could not load the grade"
		:loading="existing.loading"
		@retry="existing.reload()"
	/>

	<!-- Two columns on a phone, one row from `md`: the form is pinned to the
	     foot of the workspace, so every line it saves goes to the player. -->
	<form
		v-else
		class="grid grid-cols-2 gap-3 md:flex md:items-end md:gap-4"
		novalidate
		@submit.prevent="save"
	>
		<FormControl
			v-if="showMarks"
			v-model="marks"
			class="col-span-2 md:w-36"
			type="number"
			label="Marks obtained"
			:placeholder="`0 – ${maxMarks}`"
			:description="marksGrade"
			:error="marksError"
			min="0"
			:max="maxMarks"
			step="any"
		/>

		<FormControl
			v-if="showGrade"
			v-model="gradeLetter"
			class="col-span-2 md:w-36"
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
			:label="graded ? 'Update grade' : 'Save grade'"
		/>
	</form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, FormControl, Skeleton, toast, useCall } from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'
import { gradeForMarks } from '@/lib/grades'
import { trySubmit } from '@/lib/trySubmit'
import { GRADE_SCALE, type EvaluationType, type GradeBand } from '@/types'

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
	evaluationType: EvaluationType
}>()

const emit = defineEmits<{ saved: [] }>()

const showMarks = computed(() => props.evaluationType !== 'Grade')
const showGrade = computed(() => props.evaluationType !== 'Marks')

const gradeOptions = [
	{ label: 'No grade', value: '' },
	...GRADE_SCALE.map((letter) => ({ label: letter, value: letter })),
]

const marks = ref('')
const gradeLetter = ref('')
const remarks = ref('')
const marksError = ref('')
const seeded = ref(false)
const graded = ref(false)

const existing = useCall<SubmissionGrade | null, { submission: string }>({
	url: '/api/v2/method/cs17_portal.api.get_submission_grade',
	method: 'GET',
	params: () => ({ submission: props.submission }),
	refetch: true,
})

const failed = useLoadFailed(existing, { except: isRefusal })

// `isFinished`, not `data`: an ungraded submission answers with `null`, which
// never changes the data ref and so would never fire a watcher on it.
watch(
	() => existing.isFinished,
	(finished) => {
		if (!finished || seeded.value || existing.error) return
		const grade = existing.data
		marks.value = grade?.marks_obtained != null ? String(grade.marks_obtained) : ''
		gradeLetter.value = grade?.grade ?? ''
		remarks.value = grade?.remarks ?? ''
		graded.value = grade != null
		seeded.value = true
	},
	{ immediate: true },
)

const bands = useCall<GradeBand[]>({
	url: '/api/v2/method/cs17_portal.api.get_grade_bands',
	method: 'GET',
	immediate: false,
})

watch(
	() => props.evaluationType,
	(evaluationType) => {
		if (evaluationType === 'Marks') bands.fetch()
	},
	{ immediate: true },
)

const marksGrade = computed(() => {
	const letter = gradeForMarks(bands.data ?? [], marks.value, props.maxMarks)
	return letter ? `Grade ${letter}` : ''
})

const saveCall = useCall<
	SubmissionGrade,
	{
		submission: string
		marks_obtained: number | null
		grade: string | null
		remarks?: string
	}
>({
	url: '/api/v2/method/cs17_portal.api.save_grade',
	method: 'POST',
	immediate: false,
})

/** `null` for "no marks", a number otherwise — or an error message. */
function readMarks(): { value: number | null } | { error: string } {
	const raw = marks.value.trim()
	if (!showMarks.value) return { value: null }
	if (raw === '') return { error: 'Enter the marks.' }
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

	await trySubmit(saveCall, {
		submission: props.submission,
		marks_obtained: parsed.value,
		grade: showGrade.value && gradeLetter.value ? gradeLetter.value : null,
		remarks: remarks.value.trim() || undefined,
	})

	if (saveCall.error) {
		toast.error(frappeErrorMessage(saveCall.error, 'Could not save the grade.'))
		return
	}

	graded.value = true
	toast.success('Grade saved.')
	emit('saved')
}
</script>
