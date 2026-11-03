<template>
	<div class="flex h-full flex-col overflow-hidden bg-surface-base md:absolute md:inset-0">
		<div
			class="flex min-h-12 shrink-0 items-center gap-2 border-b border-outline-gray-1 px-3 sm:px-5"
		>
			<Button
				variant="ghost"
				icon="lucide-arrow-left"
				aria-label="Back to exams"
				tooltip="Exams"
				route="/exams"
			/>
			<h1 class="min-w-0 truncate text-base text-ink-gray-8" :title="exam.title">
				{{ exam.title }}
			</h1>

			<div class="ml-auto flex shrink-0 items-center gap-2">
				<Badge v-if="isPaused" theme="amber" label="Paused" />
				<TimeLeft
					v-else
					:key="attempt.ends_at"
					:ends-at="attempt.ends_at"
					:now="exam.now"
					@end="onTimeUp"
				/>
				<Button variant="solid" label="Finish exam" @click="confirmFinish" />
			</div>
		</div>

		<div
			v-if="exam.banner || isPaused || isTimeUp"
			class="shrink-0 space-y-2 border-b border-outline-gray-1 px-3 py-2 sm:px-5"
		>
			<AnnouncementAlert v-if="exam.banner" :title="exam.banner" variant="info" />
			<AnnouncementAlert v-if="isPaused" title="Paused by your teacher" variant="warning" />
			<AnnouncementAlert
				v-else-if="isTimeUp"
				title="Time is up. Your saved work is being submitted."
				variant="warning"
			/>
		</div>

		<div class="flex min-h-0 flex-1 flex-col md:flex-row">
			<nav
				aria-label="Questions"
				class="shrink-0 overflow-y-auto border-r border-outline-gray-1 max-md:hidden md:w-64"
			>
				<ExamQuestionList v-model="activeAssignment" :questions="exam.questions" />
			</nav>
			<div class="shrink-0 border-b border-outline-gray-1 px-3 py-2 md:hidden">
				<Select
					v-model="activeAssignment"
					:options="questionOptions"
					aria-label="Question"
				/>
			</div>

			<div class="min-h-0 flex-1">
				<KeepAlive>
					<ExamQuestionEditor
						v-if="activeQuestion && activeProject && !activeQuestion.is_locked"
						:key="activeProject"
						ref="editor"
						:exam="exam.name"
						:assignment="activeQuestion.assignment"
						:project="activeProject"
						:title="activeQuestion.title"
						:runner="runner"
						:read-only="isPaused || isTimeUp"
						:can-skip="isOneByOne && !isPassed(activeQuestion)"
						:can-come-back="canComeBack"
						@changed="emit('changed')"
					/>
				</KeepAlive>

				<EmptyState
					v-if="!activeQuestion"
					icon="lucide-file-question"
					title="This exam has no questions"
				/>
				<EmptyState
					v-else-if="activeQuestion.is_locked"
					icon="lucide-lock"
					title="This question is locked"
					:description="
						isPassed(activeQuestion)
							? 'Going back is off for this exam.'
							: 'It opens after you submit or skip the question before it.'
					"
				/>
				<LoadError
					v-else-if="openFailed === activeQuestion.assignment"
					title="Could not open this question"
					:loading="openCall.loading"
					@retry="openQuestion(activeQuestion.assignment)"
				/>
				<div v-else-if="!activeProject" class="flex h-full items-center justify-center">
					<LoadingIndicator class="size-6 text-ink-gray-5" />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
	Badge,
	Button,
	LoadingIndicator,
	Select,
	dialog,
	toast,
	useCall,
	usePageMeta,
} from 'frappe-ui'
import AnnouncementAlert from '@/components/announcements/AnnouncementAlert.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import ExamQuestionEditor from '@/components/exams/ExamQuestionEditor.vue'
import ExamQuestionList from '@/components/exams/ExamQuestionList.vue'
import {
	QUESTION_STATES,
	isPassed,
	marksLabel,
	type CodingExam,
	type ExamAttempt,
	type ExamQuestion,
} from '@/components/exams/codingExam'
import TimeLeft from '@/components/python/TimeLeft.vue'
import { useZenOnMount } from '@/composables/useZenMode'
import { parseDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { usePythonRunner } from '@/lib/python/runner'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{ exam: CodingExam; attempt: ExamAttempt }>()

const emit = defineEmits<{ changed: [] }>()

useZenOnMount()
usePageMeta(() => ({ title: `${props.exam.title} | CS17 Portal` }))

const runner = usePythonRunner()
const editor = ref<InstanceType<typeof ExamQuestionEditor> | null>(null)

const isOneByOne = computed(() => props.exam.question_order === 'One by one')
const canComeBack = computed(() => !isOneByOne.value || Boolean(props.exam.can_go_back))
const isPaused = computed(() => Boolean(props.attempt.is_paused))

const timeIsUp = ref(hasEnded())
const isTimeUp = computed(() => timeIsUp.value && !isPaused.value)

function hasEnded() {
	return parseDatetime(props.attempt.ends_at).valueOf() <= parseDatetime(props.exam.now).valueOf()
}

watch(
	() => props.attempt.ends_at,
	() => {
		timeIsUp.value = hasEnded()
	},
)

function onTimeUp() {
	timeIsUp.value = true
	editor.value?.save()
}

function nextOpenQuestion(after = -1) {
	const isOpen = (question: ExamQuestion) => !question.is_locked && !isPassed(question)
	const questions = props.exam.questions
	return (
		questions.find((question, index) => index > after && isOpen(question)) ??
		questions.find(isOpen)
	)
}

const activeAssignment = ref<string | null>(
	(nextOpenQuestion() ?? props.exam.questions[0])?.assignment ?? null,
)
const activeQuestion = computed(
	() =>
		props.exam.questions.find((question) => question.assignment === activeAssignment.value) ??
		null,
)

watch(activeQuestion, (question, previous) => {
	if (!question || !previous || question.assignment !== previous.assignment) return
	const movedOn =
		(isOneByOne.value && isPassed(question) && !isPassed(previous)) ||
		(Boolean(question.is_locked) && !previous.is_locked)
	if (!movedOn) return
	const index = props.exam.questions.indexOf(question)
	activeAssignment.value = nextOpenQuestion(index)?.assignment ?? question.assignment
})

const questionOptions = computed(() =>
	props.exam.questions.map((question, index) => ({
		label: `${index + 1}. ${question.title}`,
		value: question.assignment,
		description: `${marksLabel(question.marks)} · ${QUESTION_STATES[question.state].label}`,
		icon: question.is_locked ? 'lucide-lock' : undefined,
	})),
)

const openedProjects = reactive<Record<string, string>>({})
const activeProject = computed(
	() =>
		activeQuestion.value &&
		(activeQuestion.value.project ?? openedProjects[activeQuestion.value.assignment]),
)
const openCall = useCall<{ project: string }, { exam: string; assignment: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.open_exam_question',
	method: 'POST',
	immediate: false,
})
const openFailed = ref<string | null>(null)
let opening: Promise<unknown> = Promise.resolve()

watch(
	() =>
		activeQuestion.value &&
		!activeQuestion.value.is_locked &&
		!activeProject.value &&
		activeQuestion.value.assignment,
	(assignment) => {
		if (assignment && openFailed.value !== assignment) openQuestion(assignment)
	},
	{ immediate: true },
)

function openQuestion(assignment: string) {
	opening = opening.then(async () => {
		if (openedProjects[assignment]) return
		openFailed.value = null
		const opened = await trySubmit(openCall, { exam: props.exam.name, assignment })
		if (!opened?.project) {
			openFailed.value = assignment
			toast.error(frappeErrorMessage(openCall.error, 'Could not open this question.'))
			return
		}
		openedProjects[assignment] = opened.project
		emit('changed')
	})
}

const finishCall = useCall<null, { exam: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.finish_coding_exam',
	method: 'POST',
	immediate: false,
})

function confirmFinish() {
	const notSubmitted = props.exam.questions
		.filter((question) => question.state !== 'submitted')
		.map((question) => question.title)
	dialog.confirm({
		title: 'Finish the exam?',
		message: notSubmitted.length
			? `Not submitted yet: ${notSubmitted.join(', ')}. Finishing submits the code you saved for them. You cannot change anything after this.`
			: 'Every question is submitted. You cannot change anything after this.',
		confirmLabel: 'Finish exam',
		onConfirm: finish,
	})
}

async function finish() {
	await editor.value?.save()
	await trySubmit(finishCall, { exam: props.exam.name })
	if (finishCall.error) {
		toast.error(frappeErrorMessage(finishCall.error, 'Could not finish the exam.'))
		return
	}
	toast.success('Exam finished')
	emit('changed')
}
</script>
