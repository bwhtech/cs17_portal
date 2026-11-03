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

			<section class="space-y-3 border-t border-outline-gray-1 pt-4">
				<div class="space-y-1">
					<FormLabel label="Rules" />
					<p class="text-p-sm text-ink-gray-5">
						Students taking the exam get a change within 10 seconds.
					</p>
				</div>
				<Checkbox
					v-model="draft.rules.require_fullscreen"
					label="Require full screen"
					description="Leaving full screen covers the exam until the student returns to it."
				/>
				<Checkbox
					v-model="draft.rules.count_window_switches"
					label="Count window switches"
					description="Count leaving the browser window, not only leaving the tab."
				/>
				<FormControl
					v-model="draft.rules.paste_rule"
					type="select"
					label="Pasting"
					:options="PASTE_RULES"
					:description="PASTE_RULE_HELP[draft.rules.paste_rule]"
				/>
				<Checkbox
					v-model="draft.rules.watch_copy"
					label="Watch copying the question"
					description="Note when a student copies the question text."
				/>
				<div class="grid gap-3 sm:grid-cols-2">
					<FormControl
						v-model="draft.rules.leave_limit"
						type="number"
						label="Leave limit"
						description="Leaves before the action below. 0 is off."
						min="0"
						step="1"
						:error="errors.leave_limit"
					/>
					<FormControl
						v-model="draft.rules.leave_seconds"
						type="number"
						label="Seconds away"
						description="Seconds away in total before the action below. 0 is off."
						min="0"
						step="1"
						:error="errors.leave_seconds"
					/>
				</div>
				<FormControl
					v-model="draft.rules.leave_action"
					type="select"
					label="When a limit is reached"
					:options="LEAVE_ACTIONS"
				/>
				<FormControl
					v-model="draft.rules.alert_kinds"
					type="multiselect"
					label="Alerts"
					placeholder="Every kind"
					description="What the live board alerts you about. Pick none for every kind."
					:options="ALERT_KINDS"
				/>
				<Checkbox
					v-model="draft.rules.require_seb"
					label="Require Safe Exam Browser"
					description="Students can open the exam only in Safe Exam Browser."
				/>
				<FormControl
					v-if="draft.rules.require_seb"
					v-model="draft.rules.seb_browser_exam_key"
					type="password"
					label="Browser Exam Key"
					:placeholder="
						exam?.has_seb_key ? 'Saved. Type a new key to replace it.' : undefined
					"
					description="From SEB Config Tool, Exam tab. Several keys: separate them with a space."
					:error="errors.seb_browser_exam_key"
				/>
			</section>

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
	FormLabel,
	toast,
	useCall,
} from 'frappe-ui'
import ExamQuestionsField, {
	type QuestionDraft,
} from '@/components/exams/faculty/ExamQuestionsField.vue'
import type {
	CodingExam,
	LeaveAction,
	PasteRule,
	QuestionOrder,
} from '@/components/exams/faculty/codingExam'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useSession } from '@/composables/useSession'
import { parseDatetime, toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

interface RulesDraft {
	require_fullscreen: boolean
	count_window_switches: boolean
	paste_rule: PasteRule
	watch_copy: boolean
	leave_limit: string
	leave_seconds: string
	leave_action: LeaveAction
	alert_kinds: string[]
	require_seb: boolean
	seb_browser_exam_key: string
}

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
	rules: RulesDraft
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
	require_fullscreen: 0 | 1
	count_window_switches: 0 | 1
	paste_rule: PasteRule
	watch_copy: 0 | 1
	leave_limit: number
	leave_seconds: number
	leave_action: LeaveAction
	alert_kinds: string
	require_seb: 0 | 1
	seb_browser_exam_key?: string
}

const QUESTION_ORDERS: QuestionOrder[] = ['Any order', 'One by one']

const PASTE_RULES: PasteRule[] = ['Allow', 'Log', 'Block outside code']

const PASTE_RULE_HELP: Record<PasteRule, string> = {
	Allow: 'Students paste anything.',
	Log: 'Pastes of code not copied in the exam editor are noted for you.',
	'Block outside code': 'Only code copied in the exam editor can be pasted.',
}

const LEAVE_ACTIONS: { label: string; value: LeaveAction }[] = [
	{ label: 'Flag the student', value: 'Flag' },
	{ label: 'Lock the question', value: 'Lock question' },
	{ label: 'Submit the exam', value: 'Submit exam' },
]

const ALERT_KINDS = [
	{ label: 'Left the tab', value: 'tab_leave' },
	{ label: 'Left the window', value: 'window_blur' },
	{ label: 'Left full screen', value: 'fullscreen_exit' },
	{ label: 'Blocked paste', value: 'paste_blocked' },
	{ label: 'Pasted code', value: 'paste' },
	{ label: 'Copied the question', value: 'copy_question' },
	{ label: 'Small window', value: 'split_screen' },
	{ label: 'Second screen', value: 'second_screen' },
	{ label: 'Signed in twice', value: 'second_login' },
	{ label: 'Many lines at once', value: 'code_jump' },
	{ label: 'Leave rule applied', value: 'rule_action' },
]

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
		rules: {
			require_fullscreen: false,
			count_window_switches: false,
			paste_rule: 'Allow',
			watch_copy: false,
			leave_limit: '0',
			leave_seconds: '0',
			leave_action: 'Flag',
			alert_kinds: [],
			require_seb: false,
			seb_browser_exam_key: '',
		},
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
		| 'leave_limit'
		| 'leave_seconds'
		| 'seb_browser_exam_key'
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
	leave_limit: '',
	leave_seconds: '',
	seb_browser_exam_key: '',
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
		rules: {
			require_fullscreen: Boolean(exam.require_fullscreen),
			count_window_switches: Boolean(exam.count_window_switches),
			paste_rule: exam.paste_rule,
			watch_copy: Boolean(exam.watch_copy),
			leave_limit: String(exam.leave_limit),
			leave_seconds: String(exam.leave_seconds),
			leave_action: exam.leave_action,
			alert_kinds: (exam.alert_kinds ?? '').split('\n').filter(Boolean),
			require_seb: Boolean(exam.require_seb),
			seb_browser_exam_key: '',
		},
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
	errors.leave_limit = ''
	errors.leave_seconds = ''
	errors.seb_browser_exam_key = ''
	errors.form = ''
	markErrors.value = []
}

function isBefore(earlier: string, later: string, orSame = false): boolean {
	const difference = parseDatetime(later).valueOf() - parseDatetime(earlier).valueOf()
	return orSame ? difference >= 0 : difference > 0
}

function isCount(value: string): boolean {
	return Number.isInteger(Number(value)) && Number(value) >= 0
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
	if (draft.is_published && !draft.questions.length) {
		errors.questions = 'Add at least one question to publish.'
	}
	if (!isCount(draft.rules.leave_limit)) errors.leave_limit = 'Use 0 or a whole number.'
	if (!isCount(draft.rules.leave_seconds)) errors.leave_seconds = 'Use 0 or a whole number.'
	if (
		draft.rules.require_seb &&
		!draft.rules.seb_browser_exam_key.trim() &&
		!props.exam?.has_seb_key
	) {
		errors.seb_browser_exam_key = 'Add the Browser Exam Key.'
	}
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
		errors.leave_limit ||
		errors.leave_seconds ||
		errors.seb_browser_exam_key ||
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
		require_fullscreen: draft.rules.require_fullscreen ? 1 : 0,
		count_window_switches: draft.rules.count_window_switches ? 1 : 0,
		paste_rule: draft.rules.paste_rule,
		watch_copy: draft.rules.watch_copy ? 1 : 0,
		leave_limit: Number(draft.rules.leave_limit),
		leave_seconds: Number(draft.rules.leave_seconds),
		leave_action: draft.rules.leave_action,
		alert_kinds: draft.rules.alert_kinds.join('\n'),
		require_seb: draft.rules.require_seb ? 1 : 0,
		...(draft.rules.seb_browser_exam_key.trim()
			? { seb_browser_exam_key: draft.rules.seb_browser_exam_key.trim() }
			: {}),
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
