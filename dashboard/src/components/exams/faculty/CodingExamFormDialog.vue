<template>
	<component
		:is="isDesktop ? Dialog : BottomSheet"
		v-bind="isDesktop ? { size: '2xl' } : {}"
		:open="open"
		:title="exam ? 'Edit exam' : 'New exam'"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4" :class="isDesktop ? undefined : 'px-4 pb-6'">
			<FormControl
				v-model="draft.title"
				type="text"
				label="Title"
				placeholder="Loops and lists exam"
				maxlength="140"
				required
				:error="errors.title"
			/>

			<div class="grid gap-3 sm:grid-cols-2">
				<FormControl
					v-model="draft.cohort"
					type="select"
					label="Cohort"
					placeholder="Select a cohort"
					:options="cohortOptions"
					required
					:error="errors.cohort"
				/>
				<FormControl
					v-model="draft.quarter"
					type="select"
					label="Quarter"
					:options="quarterOptions"
				/>
			</div>

			<FormControl
				v-model="draft.instructions"
				type="textarea"
				label="Instructions"
				description="Students read this before they start. Markdown supported."
				:rows="4"
			/>

			<FormControl
				v-model="draft.duration_minutes"
				type="number"
				label="Duration (minutes)"
				description="Each student's clock starts when they start the exam."
				min="1"
				step="1"
				required
				:error="errors.duration_minutes"
			/>

			<div class="grid gap-3 sm:grid-cols-3">
				<DateTimePicker
					label="Opens"
					placeholder="Pick a date and time"
					description="Students can start from this time."
					required
					:model-value="draft.opens_on"
					:error="errors.opens_on"
					@update:model-value="draft.opens_on = $event ?? ''"
				/>
				<DateTimePicker
					label="Last start"
					placeholder="Pick a date and time"
					description="Nobody can start after this."
					required
					:model-value="draft.last_start_on"
					:error="errors.last_start_on"
					@update:model-value="draft.last_start_on = $event ?? ''"
				/>
				<DateTimePicker
					label="Closes"
					placeholder="Pick a date and time"
					description="Every clock stops here."
					required
					:model-value="draft.closes_on"
					:error="errors.closes_on"
					@update:model-value="draft.closes_on = $event ?? ''"
				/>
			</div>

			<FormControl
				v-model="draft.question_order"
				type="select"
				label="Order"
				:options="QUESTION_ORDERS"
				:description="
					draft.question_order === 'One by one'
						? 'Students get one question at a time and can skip it.'
						: 'Students open the questions in any order and can come back to them.'
				"
			/>

			<Checkbox
				v-if="draft.question_order === 'One by one'"
				v-model="draft.can_go_back"
				label="Students can go back to an earlier question"
			/>

			<ExamQuestionsField
				v-model="draft.questions"
				:cohort="draft.cohort"
				:exam="exam?.name"
				:has-attempts="exam?.has_attempts"
				:mark-errors="markErrors"
				:error="errors.questions"
			/>

			<Checkbox
				v-model="draft.is_published"
				label="Publish"
				description="Students of the cohort see the exam once it is published, and can start it between the open and last start times."
			/>

			<ErrorMessage :message="errors.form" />

			<div class="flex justify-end border-t border-outline-gray-1 pt-4">
				<Button
					variant="solid"
					theme="gray"
					:label="exam ? 'Save exam' : 'Create exam'"
					:loading="saveCall.loading"
					@click="handleSubmit"
				/>
			</div>
		</div>
	</component>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
	BottomSheet,
	Button,
	Checkbox,
	DateTimePicker,
	Dialog,
	ErrorMessage,
	FormControl,
	toast,
	useCall,
} from 'frappe-ui'
import ExamQuestionsField, {
	type QuestionDraft,
} from '@/components/exams/faculty/ExamQuestionsField.vue'
import type { CodingExam, QuestionOrder } from '@/components/exams/faculty/codingExam'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useSession } from '@/composables/useSession'
import { parseDatetime, toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

interface ExamDraft {
	title: string
	cohort: string
	quarter: string
	instructions: string
	duration_minutes: string
	opens_on: string
	last_start_on: string
	closes_on: string
	question_order: QuestionOrder
	can_go_back: boolean
	questions: QuestionDraft[]
	is_published: boolean
}

interface SaveParams {
	exam?: string
	title: string
	cohort: string
	quarter: string
	instructions: string
	duration_minutes: number
	opens_on: string
	last_start_on: string
	closes_on: string
	question_order: QuestionOrder
	can_go_back: 0 | 1
	questions: { assignment: string; marks: number }[]
	is_published: 0 | 1
}

const QUESTION_ORDERS: QuestionOrder[] = ['Any order', 'One by one']

const props = defineProps<{
	open: boolean
	cohorts: string[]
	quarters: string[]
	exam?: CodingExam | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [exam: string] }>()

const { isDesktop } = useBreakpoint()
const { cohort: facultyCohort } = useSession()

function emptyDraft(): ExamDraft {
	return {
		title: '',
		cohort: facultyCohort.value ?? '',
		quarter: '',
		instructions: '',
		duration_minutes: '120',
		opens_on: '',
		last_start_on: '',
		closes_on: '',
		question_order: 'Any order',
		can_go_back: false,
		questions: [],
		is_published: false,
	}
}

const draft = reactive<ExamDraft>(emptyDraft())

const errors = reactive<
	Record<
		| 'title'
		| 'cohort'
		| 'duration_minutes'
		| 'opens_on'
		| 'last_start_on'
		| 'closes_on'
		| 'questions'
		| 'form',
		string
	>
>({
	title: '',
	cohort: '',
	duration_minutes: '',
	opens_on: '',
	last_start_on: '',
	closes_on: '',
	questions: '',
	form: '',
})
const markErrors = ref<string[]>([])

const cohortOptions = computed(() =>
	props.cohorts.map((cohort) => ({ label: cohort, value: cohort })),
)

const quarterOptions = computed(() => [
	{ label: 'No quarter', value: '' },
	...props.quarters.map((quarter) => ({ label: quarter, value: quarter })),
])

const saveCall = useCall<string, SaveParams>({
	url: '/api/v2/method/cs17_portal.coding_exam.save_coding_exam',
	method: 'POST',
	immediate: false,
})

watch(
	() => props.open,
	(open) => {
		if (!open) return
		clearErrors()
		if (props.exam) Object.assign(draft, fromExam(props.exam))
	},
)

watch(draft, clearErrors)

function fromExam(exam: CodingExam): ExamDraft {
	return {
		title: exam.title,
		cohort: exam.cohort,
		quarter: exam.quarter ?? '',
		instructions: exam.instructions ?? '',
		duration_minutes: String(exam.duration_minutes),
		opens_on: exam.opens_on,
		last_start_on: exam.last_start_on,
		closes_on: exam.closes_on,
		question_order: exam.question_order,
		can_go_back: Boolean(exam.can_go_back),
		questions: exam.questions.map((question) => ({
			assignment: question.assignment,
			title: question.title,
			marks: String(question.marks),
		})),
		is_published: Boolean(exam.is_published),
	}
}

function clearErrors() {
	errors.title = ''
	errors.cohort = ''
	errors.duration_minutes = ''
	errors.opens_on = ''
	errors.last_start_on = ''
	errors.closes_on = ''
	errors.questions = ''
	errors.form = ''
	markErrors.value = []
}

function isBefore(earlier: string, later: string, orSame = false): boolean {
	const difference = parseDatetime(later).valueOf() - parseDatetime(earlier).valueOf()
	return orSame ? difference >= 0 : difference > 0
}

function validate(): boolean {
	clearErrors()
	if (!draft.title.trim()) errors.title = 'Title is required.'
	if (!draft.cohort) errors.cohort = 'Cohort is required.'
	if (!(Number(draft.duration_minutes) > 0)) errors.duration_minutes = 'Give it a duration.'
	if (!draft.opens_on) errors.opens_on = 'Pick when it opens.'
	if (!draft.last_start_on) errors.last_start_on = 'Pick the last start time.'
	else if (draft.opens_on && !isBefore(draft.opens_on, draft.last_start_on)) {
		errors.last_start_on = 'Make it later than the open time.'
	}
	if (!draft.closes_on) errors.closes_on = 'Pick when it closes.'
	else if (draft.last_start_on && !isBefore(draft.last_start_on, draft.closes_on, true)) {
		errors.closes_on = 'Make it no earlier than the last start time.'
	}
	if (!draft.questions.length) errors.questions = 'Add at least one question.'
	markErrors.value = draft.questions.map((question) =>
		Number(question.marks) > 0 ? '' : 'Above 0.',
	)
	return !(
		errors.title ||
		errors.cohort ||
		errors.duration_minutes ||
		errors.opens_on ||
		errors.last_start_on ||
		errors.closes_on ||
		errors.questions ||
		markErrors.value.some(Boolean)
	)
}

async function handleSubmit() {
	if (!validate()) return
	const name = await trySubmit(saveCall, {
		...(props.exam ? { exam: props.exam.name } : {}),
		title: draft.title.trim(),
		cohort: draft.cohort,
		quarter: draft.quarter,
		instructions: draft.instructions,
		duration_minutes: Number(draft.duration_minutes),
		opens_on: toFrappeDatetime(draft.opens_on),
		last_start_on: toFrappeDatetime(draft.last_start_on),
		closes_on: toFrappeDatetime(draft.closes_on),
		question_order: draft.question_order,
		can_go_back: draft.question_order === 'One by one' && draft.can_go_back ? 1 : 0,
		questions: draft.questions.map((question) => ({
			assignment: question.assignment,
			marks: Number(question.marks),
		})),
		is_published: draft.is_published ? 1 : 0,
	})
	if (saveCall.error || !name) {
		errors.form = frappeErrorMessage(saveCall.error, 'Could not save the exam.')
		return
	}
	toast.success(props.exam ? 'Exam saved' : 'Exam created')
	if (!props.exam) Object.assign(draft, emptyDraft())
	emit('update:open', false)
	emit('saved', name)
}
</script>
