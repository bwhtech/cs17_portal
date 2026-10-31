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
			:required="remarksOnly && !voiceRemark"
			:error="remarksError"
		/>

		<Dropdown
			:options="savedRemarkOptions"
			side="top"
			@update:open="(open) => open && savedRemarks.reload()"
		>
			<Button
				class="col-span-2 w-full md:w-auto"
				icon-left="lucide-bookmark"
				label="Saved remarks"
				:loading="saveRemarkCall.loading || deleteRemarkCall.loading"
			/>
			<template #item-remark="{ item }">
				<div class="max-w-64 truncate leading-tighter text-ink-gray-7">
					{{ item.label }}
				</div>
			</template>
		</Dropdown>

		<CheckWithAIButton
			v-if="aiModels?.length"
			:models="aiModels"
			class="col-span-2 w-full md:w-auto"
			icon-left="lucide-sparkles"
			label="Check with AI"
			:loading="aiCheck.loading"
			@check="checkWithAi"
		/>

		<VoiceNoteRecorder
			ref="recorder"
			v-model="voiceRemark"
			class="col-span-2 md:w-64 md:self-stretch"
			:error="voiceRemarkError"
		/>

		<Button
			class="col-span-2 w-full md:w-auto"
			variant="solid"
			theme="gray"
			type="submit"
			:loading="saveCall.loading"
			:label="`${graded ? 'Update' : 'Save'} ${noun}`"
		/>
	</form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Button,
	Dropdown,
	FormControl,
	Skeleton,
	toast,
	useCall,
	type DropdownOptions,
} from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'
import { gradeForMarks } from '@/lib/grades'
import { unescapeTags } from '@/lib/markdown'
import { trySubmit } from '@/lib/trySubmit'
import VoiceNoteRecorder from '@/components/feedback/VoiceNoteRecorder.vue'
import CheckWithAIButton from '@/components/grading/CheckWithAIButton.vue'
import { GRADE_SCALE, type AIGradeDraft, type EvaluationType, type GradeBand } from '@/types'

interface SubmissionGrade {
	name: string
	marks_obtained: number | null
	grade: string | null
	remarks: string | null
	voice_remark: string | null
}

const props = defineProps<{
	/** `CS17 Assignment Submission` name. */
	submission: string
	maxMarks: number
	evaluationType: EvaluationType | '' | null
	suggestedMarks?: number | null
	aiModels?: string[]
}>()

const emit = defineEmits<{ saved: [] }>()

const showMarks = computed(() => props.evaluationType === 'Marks')
const showGrade = computed(() => props.evaluationType === 'Grade')
const remarksOnly = computed(() => !props.evaluationType)
const noun = computed(() => (remarksOnly.value ? 'remarks' : 'grade'))

const gradeOptions = [
	{ label: 'No grade', value: '' },
	...GRADE_SCALE.map((letter) => ({ label: letter, value: letter })),
]

const marks = ref('')
const gradeLetter = ref('')
const remarks = ref('')
const marksError = ref('')
const remarksError = ref('')
const voiceRemark = ref<string | null>(null)
const voiceRemarkError = ref('')
const recorder = ref<InstanceType<typeof VoiceNoteRecorder> | null>(null)
let savedVoiceRemark: string | null = null
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
		remarks.value = unescapeTags(grade?.remarks ?? '')
		savedVoiceRemark = grade?.voice_remark || null
		voiceRemark.value = savedVoiceRemark
		graded.value = grade != null
		seeded.value = true
	},
	{ immediate: true },
)

watch(voiceRemark, () => (voiceRemarkError.value = ''))

watch(
	() => [seeded.value, props.suggestedMarks] as const,
	([isSeeded, suggested]) => {
		if (isSeeded && !graded.value && marks.value === '' && suggested != null) {
			marks.value = String(suggested)
		}
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
		voice_remark?: string
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
	const isRecording = Boolean(recorder.value?.isRecording)
	voiceRemarkError.value = isRecording ? 'Stop recording before you save.' : ''
	remarksError.value =
		remarksOnly.value && !remarks.value.trim() && !voiceRemark.value && !isRecording
			? 'Enter the remarks or record a voice note.'
			: ''
	if (remarksError.value || voiceRemarkError.value) return

	await trySubmit(saveCall, {
		submission: props.submission,
		marks_obtained: parsed.value,
		grade: showGrade.value && gradeLetter.value ? gradeLetter.value : null,
		remarks: remarks.value.trim() || undefined,
		voice_remark:
			voiceRemark.value === savedVoiceRemark ? undefined : (voiceRemark.value ?? ''),
	})

	if (saveCall.error) {
		toast.error(frappeErrorMessage(saveCall.error, `Could not save the ${noun.value}.`))
		return
	}

	savedVoiceRemark = voiceRemark.value
	graded.value = true
	toast.success(remarksOnly.value ? 'Remarks saved.' : 'Grade saved.')
	emit('saved')
}

const aiCheck = useCall<AIGradeDraft, { submission: string; model: string }>({
	url: '/api/v2/method/cs17_portal.api.check_submission',
	method: 'POST',
	immediate: false,
})

async function checkWithAi(model: string) {
	await trySubmit(aiCheck, { submission: props.submission, model })
	if (aiCheck.error || !aiCheck.data) {
		toast.error(frappeErrorMessage(aiCheck.error, 'Could not check with AI.'))
		return
	}
	const draft = aiCheck.data
	if (draft.marks_obtained != null) marks.value = String(draft.marks_obtained)
	if (draft.grade) gradeLetter.value = draft.grade
	if (draft.remarks) remarks.value = draft.remarks
	marksError.value = ''
	toast.success('AI draft filled in. Review it, then save.')
}

interface SavedRemark {
	name: string
	remark: string
}

const savedRemarks = useCall<SavedRemark[]>({
	url: '/api/v2/method/cs17_portal.saved_remarks.get_saved_remarks',
	method: 'GET',
})

const saveRemarkCall = useCall<string, { remark: string }>({
	url: '/api/v2/method/cs17_portal.saved_remarks.save_remark',
	method: 'POST',
	immediate: false,
})

const deleteRemarkCall = useCall<null, { saved_remark: string }>({
	url: '/api/v2/method/cs17_portal.saved_remarks.delete_saved_remark',
	method: 'POST',
	immediate: false,
})

const savedRemarkOptions = computed<DropdownOptions>(() => {
	const saved = (savedRemarks.data ?? []).map((row) => ({
		...row,
		remark: unescapeTags(row.remark),
	}))
	return [
		{
			group: 'Saved remarks',
			hideLabel: true,
			options: saved.map(({ remark }) => ({
				label: remark,
				slot: 'remark',
				onClick: () => addSavedRemark(remark),
			})),
		},
		{
			label: 'Save current remarks',
			icon: 'lucide-bookmark-plus',
			onClick: saveCurrentRemarks,
		},
		{
			label: 'Delete a saved remark',
			icon: 'lucide-trash-2',
			theme: 'red',
			condition: () => saved.length > 0,
			submenu: saved.map(({ name, remark }) => ({
				label: remark,
				slot: 'remark',
				onClick: () => deleteSavedRemark(name),
			})),
		},
	]
})

function addSavedRemark(remark: string) {
	const current = remarks.value.trimEnd()
	remarks.value = current ? `${current}\n${remark}` : remark
	remarksError.value = ''
}

async function saveCurrentRemarks() {
	const remark = remarks.value.trim()
	remarksError.value = remark ? '' : 'Enter the remarks to save.'
	if (remarksError.value) return

	await trySubmit(saveRemarkCall, { remark })
	if (saveRemarkCall.error) {
		toast.error(frappeErrorMessage(saveRemarkCall.error, 'Could not save the remark.'))
		return
	}
	savedRemarks.reload()
	toast.success('Remark saved')
}

async function deleteSavedRemark(savedRemark: string) {
	await trySubmit(deleteRemarkCall, { saved_remark: savedRemark })
	if (deleteRemarkCall.error) {
		toast.error(frappeErrorMessage(deleteRemarkCall.error, 'Could not delete the remark.'))
		return
	}
	savedRemarks.reload()
	toast.success('Remark deleted')
}
</script>
