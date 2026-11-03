<template>
	<AppHeader title="Exam">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/faculty/exams" />
		</template>
		<template v-if="exam" #actions>
			<template v-if="isDesktop">
				<Button icon-left="lucide-pencil" label="Edit" @click="formOpen = true" />
				<Button
					v-if="exam.is_published"
					icon-left="lucide-activity"
					label="Live"
					:route="`/faculty/exams/${exam.name}/live`"
				/>
				<Button
					v-if="running.length"
					icon-left="lucide-timer"
					label="Add time"
					@click="openAddTime()"
				/>
				<Button
					v-if="running.length"
					:icon-left="everyonePaused ? 'lucide-play' : 'lucide-pause'"
					:label="everyonePaused ? 'Resume' : 'Pause'"
					@click="confirmPauseAll"
				/>
				<Button icon-left="lucide-megaphone" label="Banner" @click="promptBanner" />
				<Button
					icon-left="lucide-calendar-clock"
					label="Move close time"
					@click="closeTimeOpen = true"
				/>
				<Button
					v-if="!exam.is_published"
					variant="solid"
					theme="gray"
					icon-left="lucide-send"
					label="Publish"
					@click="confirmPublish"
				/>
			</template>
			<Dropdown v-else :options="headerActions" align="end">
				<Button variant="ghost" icon="lucide-ellipsis" aria-label="More actions" />
			</Dropdown>
		</template>
	</AppHeader>

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load this exam"
			:loading="examCall.loading"
			@retry="examCall.reload()"
		/>

		<PageSkeleton v-else-if="examCall.loading && !exam" />

		<EmptyState
			v-else-if="!exam"
			icon="lucide-file-question"
			title="Exam not found"
			description="It may have been deleted."
		>
			<template #action>
				<Button label="Back to exams" route="/faculty/exams" />
			</template>
		</EmptyState>

		<div v-else class="space-y-6">
			<h1 class="break-words text-2xl text-ink-gray-9 md:sr-only">{{ exam.title }}</h1>

			<Alert
				v-if="exam.banner"
				class="break-words [&_[data-slot=description]]:whitespace-pre-line"
				theme="blue"
				title="Banner on every student's exam"
				:description="exam.banner"
			/>

			<div class="flex flex-col gap-6 md:flex-row">
				<div class="min-w-0 flex-1 space-y-6">
					<MarkdownText v-if="exam.instructions" :content="exam.instructions" />

					<section class="space-y-3">
						<h2 class="text-lg font-semibold text-ink-gray-8">Questions</h2>
						<ol
							class="divide-y divide-outline-gray-1 rounded-4 border border-outline-gray-1 bg-surface-base"
						>
							<li
								v-for="(question, index) in exam.questions"
								:key="question.assignment"
								class="flex items-center gap-3 px-4 py-2.5 text-base"
							>
								<RouterLink
									class="min-w-0 flex-1 truncate text-ink-gray-8 hover:underline"
									:to="`/faculty/assignments/${question.assignment}`"
								>
									{{ index + 1 }}. {{ question.title }}
								</RouterLink>
								<span class="shrink-0 text-ink-gray-5">
									{{ formatMarks(question.marks) }} marks
								</span>
							</li>
						</ol>
					</section>

					<SafeExamBrowserSetup v-if="exam.require_seb" :start-url="exam.seb_start_url" />
				</div>

				<div class="w-full shrink-0 md:w-64">
					<dl
						class="space-y-3 rounded-4 border border-outline-gray-1 bg-surface-base p-4"
					>
						<div v-for="meta in metaRows" :key="meta.label">
							<dt class="text-xs text-ink-gray-5">{{ meta.label }}</dt>
							<dd class="text-base font-medium text-ink-gray-8">{{ meta.value }}</dd>
						</div>
					</dl>
				</div>
			</div>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">Students</h2>

				<LoadError
					v-if="studentsFailed"
					title="Could not load the students"
					:loading="studentsCall.loading"
					@retry="studentsCall.reload()"
				/>

				<DataTable
					v-else
					:columns="columns"
					:rows="students"
					:row-key="(row: ExamStudent) => row.student"
					:loading="studentsCall.loading && !studentsCall.data"
					empty="No students in this cohort yet."
				>
					<template #cell-student="{ row }">
						<RowTitle
							:title="row.full_name ?? row.student"
							:to="`/faculty/students/${row.student}`"
						/>
					</template>

					<template #cell-state="{ row }">
						<Badge v-bind="attemptState(row)" variant="subtle" />
					</template>

					<template #cell-started="{ row }">
						<span v-if="row.started_at" class="truncate text-ink-gray-6">{{
							formatDateTime(row.started_at)
						}}</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-time_left="{ row }">
						<span
							v-if="row.state === 'in_progress' && row.ends_at"
							class="tabular-nums text-ink-gray-8"
						>
							{{ timeLeft(row.ends_at) }}
						</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-extra_time="{ row }">
						<span v-if="row.extra_minutes" class="text-ink-gray-8">
							+{{ row.extra_minutes }} min
						</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-questions="{ row }">
						<ul class="flex flex-wrap gap-1">
							<li
								v-for="(question, index) in row.questions"
								:key="question.assignment"
							>
								<Badge
									:label="String(index + 1)"
									:theme="QUESTION_STATES[question.state].theme"
									variant="subtle"
									:title="questionState(question)"
									aria-hidden="true"
								/>
								<span class="sr-only">{{ questionState(question) }}</span>
							</li>
						</ul>
					</template>

					<template #cell-marks="{ row }">
						<span class="text-ink-gray-8">{{
							formatMarks(row.total_marks, row.max_marks)
						}}</span>
					</template>

					<template #cell-actions="{ row }">
						<div v-if="row.state === 'in_progress'" class="flex md:justify-end">
							<Dropdown :options="studentActions(row)" align="end">
								<Button
									icon="lucide-ellipsis"
									:aria-label="`Actions for ${row.full_name ?? row.student}`"
								/>
							</Dropdown>
						</div>
					</template>
				</DataTable>
			</section>

			<ExamChangeLog v-if="exam.changes.length" :changes="exam.changes" />
		</div>
	</PageBody>

	<CodingExamFormDialog
		v-if="exam"
		v-model:open="formOpen"
		:cohorts="cohortsCall.data ?? []"
		:quarters="quartersCall.data ?? []"
		:exam="exam"
		@saved="reload"
	/>

	<AddExamTimeDialog
		v-if="addTimeOpen && exam"
		v-model:open="addTimeOpen"
		:exam="exam.name"
		:students="running"
		:initial-student="addTimeStudent"
		@saved="reload"
	/>

	<ExamCloseTimeDialog
		v-if="closeTimeOpen && exam"
		v-model:open="closeTimeOpen"
		:exam="exam.name"
		:current-closes-on="exam.closes_on"
		@saved="reload"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
	Alert,
	Badge,
	Button,
	Dropdown,
	PageHeaderBackButton,
	dialog,
	toast,
	useCall,
	type DropdownActionOption,
} from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import AddExamTimeDialog from '@/components/exams/faculty/AddExamTimeDialog.vue'
import CodingExamFormDialog from '@/components/exams/faculty/CodingExamFormDialog.vue'
import ExamChangeLog from '@/components/exams/faculty/ExamChangeLog.vue'
import ExamCloseTimeDialog from '@/components/exams/faculty/ExamCloseTimeDialog.vue'
import SafeExamBrowserSetup from '@/components/exams/faculty/SafeExamBrowserSetup.vue'
import {
	formatMinutes,
	type CodingExam,
	type ExamQuestionState,
	type ExamStudent,
} from '@/components/exams/faculty/codingExam'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolledCall, usePolling } from '@/composables/usePolling'
import { formatDateTime, parseDatetime, toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'
import { formatMarks } from '@/lib/results'
import { trySubmit } from '@/lib/trySubmit'

const QUESTION_STATES: Record<
	ExamQuestionState,
	{ label: string; theme: 'gray' | 'blue' | 'green' | 'amber' }
> = {
	not_started: { label: 'Not started', theme: 'gray' },
	in_progress: { label: 'In progress', theme: 'blue' },
	submitted: { label: 'Submitted', theme: 'green' },
	skipped: { label: 'Skipped', theme: 'amber' },
}

const EXAM_POLL_MS = 10_000

const props = defineProps<{ examId: string }>()

const breadcrumbs = useBreadcrumbs()
const { isDesktop } = useBreakpoint()

const examCall = usePolledCall<CodingExam, { exam: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.get_coding_exam',
	method: 'GET',
	params: () => ({ exam: props.examId }),
	refetch: true,
})

const studentsCall = usePolledCall<ExamStudent[], { exam: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.get_coding_exam_students',
	method: 'GET',
	params: () => ({ exam: props.examId }),
	refetch: true,
})

const now = ref(Date.now())

usePolling(() => {
	now.value = Date.now()
	reload()
}, EXAM_POLL_MS)

const exam = computed(() => (examCall.data?.name === props.examId ? examCall.data : null))
const failed = useLoadFailed(examCall, { except: isRefusal })
const studentsFailed = useLoadFailed(studentsCall)

const cohortsCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_cohorts',
	method: 'GET',
})

const quartersCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_quarters',
	method: 'GET',
})

const students = computed(() => {
	const rows = studentsCall.data ?? []
	return [
		...rows.filter((row) => row.state !== 'not_started'),
		...rows.filter((row) => row.state === 'not_started'),
	]
})

const running = computed(() => students.value.filter((row) => row.state === 'in_progress'))
const everyonePaused = computed(
	() => running.value.length > 0 && running.value.every((row) => row.is_paused),
)

const formOpen = ref(false)
const closeTimeOpen = ref(false)
const addTimeOpen = ref(false)
const addTimeStudent = ref<string | null>(null)

function reload() {
	examCall.reload()
	studentsCall.reload()
}

function openAddTime(student: string | null = null) {
	addTimeStudent.value = student
	addTimeOpen.value = true
}

const metaRows = computed(() => {
	if (!exam.value) return []
	return [
		{ label: 'Status', value: exam.value.is_published ? 'Published' : 'Draft' },
		{ label: 'Opens', value: formatDateTime(exam.value.opens_on) },
		{ label: 'Last start', value: formatDateTime(exam.value.last_start_on) },
		{ label: 'Closes', value: formatDateTime(exam.value.closes_on) },
		{ label: 'Duration', value: formatMinutes(exam.value.duration_minutes) },
		{ label: 'Order', value: exam.value.question_order },
		...(exam.value.question_order === 'One by one'
			? [{ label: 'Going back', value: exam.value.can_go_back ? 'Allowed' : 'Not allowed' }]
			: []),
		{ label: 'Cohort', value: exam.value.cohort },
		...(exam.value.quarter ? [{ label: 'Quarter', value: exam.value.quarter }] : []),
	]
})

const columns = computed<Column[]>(() => [
	{ header: 'Student', key: 'student', variant: 'primary' },
	{ header: 'State', key: 'state', width: '6.5rem' },
	{ header: 'Started', key: 'started', width: '8.5rem' },
	{ header: 'Time left', key: 'time_left', width: '5rem' },
	{ header: 'Extra time', key: 'extra_time', width: '5rem' },
	{
		header: 'Questions',
		key: 'questions',
		width: `${Math.max(5.5, (exam.value?.questions.length ?? 0) * 2)}rem`,
	},
	{ header: 'Marks', key: 'marks', width: '5rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '2.5rem', align: 'right' },
])

function attemptState(row: ExamStudent) {
	if (row.state === 'finished') return { label: 'Finished', theme: 'green' } as const
	if (row.state === 'not_started') return { label: 'Not started', theme: 'gray' } as const
	if (row.is_paused) return { label: 'Paused', theme: 'amber' } as const
	return { label: 'In progress', theme: 'blue' } as const
}

function timeLeft(endsAt: string): string {
	const minutes = Math.ceil((parseDatetime(endsAt).valueOf() - now.value) / 60_000)
	return minutes > 0 ? `${minutes} min` : 'Time up'
}

function questionState(question: ExamStudent['questions'][number]): string {
	return `${questionTitle(question.assignment)}: ${QUESTION_STATES[question.state].label}`
}

function questionTitle(assignment: string): string {
	return exam.value?.questions.find((question) => question.assignment === assignment)?.title ?? ''
}

const pause = useCall<null, { exam: string; student?: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.pause_coding_exam',
	method: 'POST',
	immediate: false,
})

const resume = useCall<null, { exam: string; student?: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.resume_coding_exam',
	method: 'POST',
	immediate: false,
})

const setBanner = useCall<null, { exam: string; banner: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.set_exam_banner',
	method: 'POST',
	immediate: false,
})

const reopen = useCall<null, { exam: string; student: string; assignment: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.reopen_exam_question',
	method: 'POST',
	immediate: false,
})

const publish = useCall<string, Record<string, unknown>>({
	url: '/api/v2/method/cs17_portal.coding_exam.save_coding_exam',
	method: 'POST',
	immediate: false,
})

function confirmPauseAll() {
	const call = everyonePaused.value ? resume : pause
	dialog.confirm({
		title: everyonePaused.value
			? 'Resume the exam for everyone?'
			: 'Pause the exam for everyone?',
		message: everyonePaused.value
			? 'Every paused clock starts again with the time it had left.'
			: 'Every running clock stops, and students cannot save or submit until you resume.',
		confirmLabel: everyonePaused.value ? 'Resume' : 'Pause',
		onConfirm: async () => {
			await trySubmit(call, { exam: props.examId })
			if (call.error) throw new Error(frappeErrorMessage(call.error, 'Nothing was changed.'))
			toast.success(call === pause ? 'Exam paused' : 'Exam resumed')
			reload()
		},
	})
}

async function toggleStudentPause(row: ExamStudent) {
	const call = row.is_paused ? resume : pause
	await trySubmit(call, { exam: props.examId, student: row.student })
	if (call.error) {
		toast.error(frappeErrorMessage(call.error, 'Nothing was changed.'))
		return
	}
	toast.success(`${row.is_paused ? 'Resumed' : 'Paused'} for ${row.full_name ?? row.student}`)
	reload()
}

function promptBanner() {
	dialog.prompt({
		title: 'Banner',
		message: "Shows at the top of every student's exam page. Leave it empty to remove it.",
		fields: [
			{
				name: 'banner',
				type: 'textarea',
				label: 'Banner',
				defaultValue: exam.value?.banner ?? '',
			},
		],
		confirmLabel: 'Save',
		onConfirm: async ({ values }) => {
			const banner = String(values.banner ?? '').trim()
			await trySubmit(setBanner, { exam: props.examId, banner })
			if (setBanner.error) {
				throw new Error(frappeErrorMessage(setBanner.error, 'Could not save the banner.'))
			}
			toast.success(banner ? 'Banner set' : 'Banner removed')
			reload()
		},
	})
}

function promptReopen(row: ExamStudent) {
	const options = row.questions
		.filter((question) => question.state === 'submitted' || question.state === 'skipped')
		.map((question) => ({
			label: questionTitle(question.assignment),
			value: question.assignment,
		}))
	dialog.prompt({
		title: 'Reopen a question',
		message: `${row.full_name ?? row.student} can work on it again while their exam runs.`,
		fields: [
			{
				name: 'assignment',
				type: 'select',
				label: 'Question',
				options,
				defaultValue: options[0]?.value,
				required: true,
			},
		],
		confirmLabel: 'Reopen',
		onConfirm: async ({ values }) => {
			await trySubmit(reopen, {
				exam: props.examId,
				student: row.student,
				assignment: String(values.assignment),
			})
			if (reopen.error) {
				throw new Error(frappeErrorMessage(reopen.error, 'Could not reopen the question.'))
			}
			toast.success('Question reopened')
			reload()
		},
	})
}

function confirmPublish() {
	const current = exam.value
	if (!current) return
	dialog.confirm({
		title: 'Publish this exam?',
		message: `Students of ${current.cohort} see it now and can start it from ${formatDateTime(current.opens_on)}.`,
		confirmLabel: 'Publish',
		onConfirm: async () => {
			await trySubmit(publish, {
				exam: current.name,
				title: current.title,
				cohort: current.cohort,
				quarter: current.quarter ?? '',
				instructions: current.instructions ?? '',
				duration_minutes: current.duration_minutes,
				opens_on: toFrappeDatetime(current.opens_on),
				last_start_on: toFrappeDatetime(current.last_start_on),
				closes_on: toFrappeDatetime(current.closes_on),
				question_order: current.question_order,
				can_go_back: current.can_go_back,
				questions: current.questions.map(({ assignment, marks }) => ({
					assignment,
					marks,
				})),
				is_published: 1,
			})
			if (publish.error) {
				throw new Error(frappeErrorMessage(publish.error, 'Could not publish the exam.'))
			}
			toast.success('Exam published')
			reload()
		},
	})
}

function studentActions(row: ExamStudent): DropdownActionOption[] {
	return [
		{ label: 'Add time', icon: 'lucide-timer', onClick: () => openAddTime(row.student) },
		{
			label: row.is_paused ? 'Resume' : 'Pause',
			icon: row.is_paused ? 'lucide-play' : 'lucide-pause',
			onClick: () => toggleStudentPause(row),
		},
		...(row.questions.some(
			(question) => question.state === 'submitted' || question.state === 'skipped',
		)
			? [
					{
						label: 'Reopen a question',
						icon: 'lucide-rotate-ccw',
						onClick: () => promptReopen(row),
					},
				]
			: []),
	]
}

const headerActions = computed<DropdownActionOption[]>(() => [
	...(exam.value && !exam.value.is_published
		? [{ label: 'Publish', icon: 'lucide-send', onClick: confirmPublish }]
		: []),
	{ label: 'Edit', icon: 'lucide-pencil', onClick: () => (formOpen.value = true) },
	...(exam.value?.is_published
		? [
				{
					label: 'Live',
					icon: 'lucide-activity',
					route: `/faculty/exams/${exam.value.name}/live`,
				},
			]
		: []),
	...(running.value.length
		? [
				{ label: 'Add time', icon: 'lucide-timer', onClick: () => openAddTime() },
				{
					label: everyonePaused.value ? 'Resume' : 'Pause',
					icon: everyonePaused.value ? 'lucide-play' : 'lucide-pause',
					onClick: confirmPauseAll,
				},
			]
		: []),
	{ label: 'Banner', icon: 'lucide-megaphone', onClick: promptBanner },
	{
		label: 'Move close time',
		icon: 'lucide-calendar-clock',
		onClick: () => (closeTimeOpen.value = true),
	},
])

watch(
	() => exam.value?.title,
	(title) => {
		breadcrumbs.set(
			title ? [{ label: 'Exams', route: '/faculty/exams' }, { label: title }] : [],
		)
	},
	{ immediate: true },
)
</script>
