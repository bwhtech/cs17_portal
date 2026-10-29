<template>
	<AppHeader title="Assignment">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/faculty/assignments" />
		</template>
		<template #actions>
			<Button
				v-if="assignment"
				:variant="isDesktop ? 'subtle' : 'ghost'"
				:icon-left="isDesktop ? 'lucide-users' : undefined"
				:icon="isDesktop ? undefined : 'lucide-users'"
				:tooltip="isDesktop ? undefined : 'Students'"
				label="Students"
				@click="studentsOpen = true"
			/>
			<Button
				v-if="assignment"
				:variant="isDesktop ? 'subtle' : 'ghost'"
				:icon-left="isDesktop ? 'lucide-clock' : undefined"
				:icon="isDesktop ? undefined : 'lucide-clock'"
				:tooltip="isDesktop ? undefined : 'Timing'"
				label="Timing"
				@click="timingOpen = true"
			/>
			<Button
				v-if="assignment"
				:variant="isDesktop ? 'subtle' : 'ghost'"
				:icon-left="isDesktop ? 'lucide-link' : undefined"
				:icon="isDesktop ? undefined : 'lucide-link'"
				:tooltip="isDesktop ? undefined : 'Copy submission link'"
				label="Copy submission link"
				@click="copySubmissionLink"
			/>
			<Button
				v-if="assignment?.submission_type === 'Python'"
				:variant="isDesktop ? 'subtle' : 'ghost'"
				:icon-left="isDesktop ? 'lucide-files' : undefined"
				:icon="isDesktop ? undefined : 'lucide-files'"
				:tooltip="isDesktop ? undefined : 'Similar code'"
				label="Similar code"
				@click="similarCodeOpen = true"
			/>
		</template>
	</AppHeader>

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load this assignment"
			:loading="detail.loading"
			@retry="detail.reload()"
		/>

		<PageSkeleton v-else-if="detail.loading && !assignment" />

		<EmptyState
			v-else-if="!assignment"
			icon="lucide-file-question"
			title="Assignment not found"
			description="It may have been deleted."
		>
			<template #action>
				<Button label="Back to assignments" route="/faculty/assignments" />
			</template>
		</EmptyState>

		<div v-else class="space-y-6">
			<h1 class="break-words text-2xl text-ink-gray-9 md:sr-only">{{ assignment.title }}</h1>
			<div class="flex flex-col gap-6 md:flex-row">
				<div class="min-w-0 flex-1">
					<MarkdownText :content="assignment.description" />
				</div>

				<div class="w-full shrink-0 md:w-64">
					<dl
						class="space-y-3 rounded-4 border border-outline-gray-1 bg-surface-base p-4"
					>
						<div v-for="meta in metaRows" :key="meta.label">
							<dt class="text-xs text-ink-gray-5">{{ meta.label }}</dt>
							<dd class="text-base font-medium text-ink-gray-8">
								{{ meta.value }}
							</dd>
						</div>
					</dl>
				</div>
			</div>

			<AnswerSheetCard
				:assignment="assignment.name"
				:sheet="sheet"
				:show-answers="answerSheet.data?.show_answers ?? false"
				@changed="answerSheet.reload()"
			/>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">
					Submissions ({{ submissions.length.toLocaleString() }} of
					{{ rows.length.toLocaleString() }})
				</h2>

				<DataTable
					v-model:selection="selection"
					:columns="columns"
					:rows="rows"
					:row-key="(row: CS17Submission) => row.name"
					:is-row-selectable="isSubmitted"
					selectable
					empty="No submissions yet."
				>
					<template #cell-student="{ row }">
						<span
							class="block truncate text-ink-gray-8"
							:title="row.full_name ?? row.student"
						>
							{{ row.full_name ?? row.student }}
						</span>
					</template>

					<template #cell-status="{ row }">
						<Badge
							v-if="row.returned_on"
							label="Returned"
							theme="amber"
							variant="subtle"
							:title="formatDateTime(row.returned_on)"
						/>
						<Badge
							v-else
							:label="isSubmitted(row) ? 'Submitted' : 'Not submitted'"
							:theme="isSubmitted(row) ? 'green' : 'gray'"
							variant="subtle"
						/>
					</template>

					<template #cell-submitted="{ row }">
						<span v-if="row.submitted_at" class="text-ink-gray-6">{{
							formatDateTime(row.submitted_at)
						}}</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-assignees="{ row }">
						<div v-if="isSubmitted(row)" class="min-w-0 max-w-full" @click.stop>
							<SubmissionAssignees
								:submission="row.name"
								:assigned-to="assigneesOf(row)"
								:cohort="assignment.cohort"
								@changed="detail.reload()"
							/>
						</div>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-grade="{ row }">
						<span v-if="row.grade" class="flex items-center gap-2">
							<span v-if="isGraded" class="text-base font-medium text-ink-gray-8">{{
								gradeValue(row.grade)
							}}</span>
							<Badge v-bind="publishStatus(row.grade)" variant="subtle" />
						</span>
						<Badge
							v-else-if="isSubmitted(row) && isGraded"
							label="Ungraded"
							theme="gray"
							variant="subtle"
						/>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-actions="{ row }">
						<div class="flex flex-wrap items-center gap-2 md:justify-end">
							<Button
								v-if="isSubmitted(row)"
								label="Preview"
								@click="openPreview(row)"
							/>
							<Button v-if="sheet" label="Answers" @click="answersTarget = row" />
							<Button
								v-if="isSubmitted(row)"
								:label="gradeActionLabel(row)"
								@click="gradeTarget = row"
							/>
							<Button
								v-if="isSubmitted(row) && !row.returned_on"
								label="Send back"
								@click="sendBackTarget = row"
							/>
						</div>
					</template>
				</DataTable>

				<SubmissionBulkActions
					v-if="selection.length"
					:submissions="selection"
					:cohort="assignment.cohort"
					:draft-grades="selectedDraftGrades"
					:remarks-only="!isGraded"
					:can-check-with-ai="assignment.can_check_with_ai"
					:ungraded-submissions="selectedUngradedSubmissions"
					@checking="waitForAiDrafts"
					@done="clearSelection"
					@clear="selection = []"
				/>
			</section>
		</div>
	</PageBody>

	<SubmissionPreviewDialog
		v-if="previewTarget"
		:open="Boolean(previewTarget)"
		:title="`Submission: ${previewTarget.full_name ?? previewTarget.student}`"
		:submission-type="assignment?.submission_type"
		:submission="previewTarget.name"
		:assignment="assignmentId"
		:file-url="previewTarget.submission_document || previewTarget.submission_url"
		@update:open="previewTarget = null"
	/>

	<AnswersDialog
		v-if="answersTarget && sheet"
		:open="Boolean(answersTarget)"
		:title="`Answers: ${answersTarget.full_name ?? answersTarget.student}`"
		:answers="answerRows"
		:summary="answersOf(answersTarget)?.summary"
		:note="sheet?.note"
		editable
		@update:open="answersTarget = null"
		@status="(task, status) => saveAnswer(answerStatus, task, { status })"
		@remark="(task, remark) => saveAnswer(answerRemark, task, { remark })"
	/>

	<GradeSubmissionDialog
		v-if="gradeTarget"
		:open="Boolean(gradeTarget)"
		:submission="gradeTarget"
		:evaluation-type="assignment?.remarks ?? 'Marks'"
		:max-marks="assignment?.max_marks"
		:can-check-with-ai="assignment?.can_check_with_ai"
		@update:open="gradeTarget = null"
		@success="detail.reload()"
	/>

	<SendBackDialog
		v-if="sendBackTarget"
		:open="Boolean(sendBackTarget)"
		:submission="sendBackTarget.name"
		:student-name="sendBackTarget.full_name ?? sendBackTarget.student"
		@update:open="sendBackTarget = null"
		@success="detail.reload()"
	/>

	<AssignmentStudentsDialog
		v-if="studentsOpen && assignment"
		v-model:open="studentsOpen"
		:assignment="assignment.name"
		:cohort="assignment.cohort ?? ''"
		:students="assignment.students ?? []"
		@saved="detail.reload()"
	/>

	<AssignmentTimingDialog
		v-if="timingOpen && assignment"
		v-model:open="timingOpen"
		:assignment="assignment"
		@saved="detail.reload()"
	/>

	<SimilarCodeDialog
		v-if="similarCodeOpen && assignment"
		v-model:open="similarCodeOpen"
		:assignment="assignment.name"
	/>
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRefs, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, PageHeaderBackButton, toast, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import SubmissionPreviewDialog from '@/components/assignments/SubmissionPreviewDialog.vue'
import AnswersDialog from '@/components/answers/AnswersDialog.vue'
import AnswerSheetCard from '@/components/faculty/AnswerSheetCard.vue'
import AssignmentStudentsDialog from '@/components/faculty/AssignmentStudentsDialog.vue'
import AssignmentTimingDialog from '@/components/faculty/AssignmentTimingDialog.vue'
import GradeSubmissionDialog from '@/components/faculty/GradeSubmissionDialog.vue'
import SendBackDialog from '@/components/faculty/SendBackDialog.vue'
import SimilarCodeDialog from '@/components/faculty/SimilarCodeDialog.vue'
import SubmissionAssignees from '@/components/faculty/SubmissionAssignees.vue'
import SubmissionBulkActions from '@/components/faculty/SubmissionBulkActions.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolling } from '@/composables/usePolling'
import { formatDateTime, isPast } from '@/lib/dates'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'
import { formatGrade } from '@/lib/grades'
import { previewKind } from '@/lib/submissionTypes'
import { trySubmit } from '@/lib/trySubmit'
import type {
	AnswerSheet,
	AnswerStatus,
	CS17Assignment,
	CS17Grade,
	CS17Student,
	CS17Submission,
} from '@/types'

const route = useRoute()
const router = useRouter()
const breadcrumbs = useBreadcrumbs()
const { isDesktop } = useBreakpoint()

const assignmentId = computed(() => String(route.params.assignmentId ?? ''))

const detail = useCall<
	{ assignment: CS17Assignment; submissions: CS17Submission[]; not_submitted: CS17Student[] },
	{ assignment: string }
>({
	url: '/api/v2/method/cs17_portal.api.get_assignment_submissions',
	params: () => ({ assignment: assignmentId.value }),
	refetch: true,
})

const loadedId = ref('')
watch(
	() => detail.data,
	() => {
		loadedId.value = assignmentId.value
	},
)

const assignment = computed(() =>
	loadedId.value === assignmentId.value ? (detail.data?.assignment ?? null) : null,
)
const failed = useLoadFailed(reactive({ ...toRefs(detail), data: assignment }), {
	except: isRefusal,
})
const submissions = computed(() => detail.data?.submissions ?? [])

/** Every student of the cohort: those who submitted first, then a bare row for each who has not. */
const rows = computed<CS17Submission[]>(() => [
	...submissions.value,
	...(detail.data?.not_submitted ?? []).map((student) => ({
		name: student.student,
		student: student.student,
		full_name: student.full_name,
		assignment: assignmentId.value,
		submitted_at: '',
	})),
])

const submissionNames = computed(() => new Set(submissions.value.map((row) => row.name)))

function isSubmitted(row: CS17Submission): boolean {
	return submissionNames.value.has(row.name)
}

const selection = ref<string[]>([])
const previewTarget = ref<CS17Submission | null>(null)
const gradeTarget = ref<CS17Submission | null>(null)
const sendBackTarget = ref<CS17Submission | null>(null)
const studentsOpen = ref(false)
const timingOpen = ref(false)
const similarCodeOpen = ref(false)

watch(assignmentId, () => {
	selection.value = []
	aiDraftsPending.value = []
})

function openPreview(row: CS17Submission) {
	const kind = previewKind(assignment.value?.submission_type, row.submission_document)
	if (kind === 'archive') router.push(`/faculty/submissions/${row.name}`)
	else previewTarget.value = row
}

const answersTarget = ref<CS17Submission | null>(null)

const answerSheet = useCall<
	{ sheet: AnswerSheet | null; show_answers: boolean },
	{ assignment: string }
>({
	url: '/api/v2/method/cs17_portal.answer_sheet.get_answer_sheet',
	params: () => ({ assignment: assignmentId.value }),
	refetch: true,
})

interface AnswerTarget {
	assignment: string
	column: string
	task: number
	student: string
}

const answerStatus = useCall<null, AnswerTarget & { status: AnswerStatus }>({
	url: '/api/v2/method/cs17_portal.answer_sheet.set_answer_status',
	method: 'POST',
	immediate: false,
})

const answerRemark = useCall<null, AnswerTarget & { remark: string }>({
	url: '/api/v2/method/cs17_portal.answer_sheet.set_answer_remark',
	method: 'POST',
	immediate: false,
})

const sheetLoadedId = ref('')
watch(
	() => answerSheet.data,
	() => {
		sheetLoadedId.value = assignmentId.value
	},
)

const sheet = computed(() =>
	sheetLoadedId.value === assignmentId.value ? (answerSheet.data?.sheet ?? null) : null,
)

watch(sheet, () => {
	if (!sheet.value) answersTarget.value = null
})

function answersOf(row: CS17Submission) {
	return sheet.value?.students.find((student) => student.student === row.student)
}

const answerRows = computed(() => {
	if (!answersTarget.value || !sheet.value) return []
	const mine = answersOf(answersTarget.value)
	return sheet.value.tasks.map((task, index) => ({
		...task,
		remark: mine?.results[index].remark ?? '',
		status: mine?.results[index].status ?? ('' as AnswerStatus),
	}))
})

async function saveAnswer<Change extends object>(
	call: { error: unknown; submit: (params?: AnswerTarget & Change) => Promise<unknown> },
	task: number,
	change: Change,
) {
	const row = answersTarget.value
	if (!row) return
	await trySubmit(call, {
		assignment: assignmentId.value,
		column: answersOf(row)?.column ?? row.full_name ?? row.student,
		task,
		student: row.student,
		...change,
	})
	if (call.error) toast.error(frappeErrorMessage(call.error, 'Could not save that.'))
	answerSheet.reload()
}

const isGraded = computed(() => assignment.value?.assignment_type === 'Graded')

const metaRows = computed(() => {
	const studentCount = assignment.value?.students?.length ?? 0
	const timeLimit = assignment.value?.time_limit
	const rows = [
		{ label: 'Due', value: formatDateTime(assignment.value?.due_date) },
		...(assignment.value?.submission_type === 'Python'
			? [
					{
						label: 'Time Limit',
						value: timeLimit
							? `${timeLimit} ${timeLimit === 1 ? 'minute' : 'minutes'}`
							: 'No limit',
					},
				]
			: []),
		...(timeLimit
			? [{ label: 'Attempts', value: String(assignment.value?.attempts_allowed || 1) }]
			: []),
		{ label: 'Cohort', value: assignment.value?.cohort ?? '—' },
		{
			label: 'Students',
			value: studentCount
				? `${studentCount} ${studentCount === 1 ? 'student' : 'students'}`
				: 'Whole cohort',
		},
		{
			label: 'Evaluation Type',
			value: isGraded.value ? assignment.value?.remarks || '—' : 'Non-graded',
		},
	]
	if (isGraded.value && assignment.value?.remarks === 'Marks') {
		rows.push({ label: 'Max Marks', value: String(assignment.value?.max_marks ?? '—') })
	}
	return rows
})

const columns = computed<Column[]>(() => [
	{ header: 'Student', key: 'student', variant: 'primary' },
	{ header: 'Status', key: 'status', width: '6.5rem' },
	{ header: 'Submitted', key: 'submitted', width: '8rem' },
	{ header: 'Assigned to', key: 'assignees', width: '9rem' },
	{ header: isGraded.value ? 'Grade' : 'Remarks', key: 'grade', width: '10rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '16rem', align: 'right' },
])

function gradeActionLabel(row: CS17Submission): string {
	if (isGraded.value) return row.grade ? 'Edit grade' : 'Grade'
	return row.grade ? 'Edit remarks' : 'Add remarks'
}

/** `_assign` is Frappe's ToDo mirror: a JSON array of user ids, or nothing. */
function assigneesOf(submission: CS17Submission): string[] {
	if (!submission._assign) return []
	try {
		const parsed = JSON.parse(submission._assign)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

function gradeValue(grade: CS17Grade): string {
	return formatGrade({
		evaluationType: assignment.value?.remarks,
		grade: grade.grade,
		marksObtained: grade.marks_obtained,
		maxMarks: assignment.value?.max_marks,
	})
}

function publishStatus(grade: CS17Grade) {
	if (grade.is_published || isPast(grade.published_on)) {
		return { label: 'Published', theme: 'green' } as const
	}
	if (grade.published_on) {
		return {
			label: 'Scheduled',
			theme: 'amber',
			title: formatDateTime(grade.published_on),
		} as const
	}
	return { label: 'Draft', theme: 'gray' } as const
}

const selectedDraftGrades = computed(
	() =>
		submissions.value.filter(
			(row) =>
				selection.value.includes(row.name) &&
				row.grade &&
				!row.grade.is_published &&
				!isPast(row.grade.published_on),
		).length,
)

const selectedUngradedSubmissions = computed(() =>
	submissions.value
		.filter((row) => selection.value.includes(row.name) && !row.grade)
		.map((row) => row.name),
)

const AI_DRAFT_POLL_MS = 5_000
const AI_DRAFT_MAX_POLLS = 60

const aiDraftsPending = ref<string[]>([])
let aiDraftPolls = 0

function waitForAiDrafts(names: string[]) {
	aiDraftsPending.value = [...aiDraftsPending.value, ...names]
	aiDraftPolls = 0
}

usePolling(() => {
	if (!aiDraftsPending.value.length) return
	aiDraftPolls += 1
	if (aiDraftPolls > AI_DRAFT_MAX_POLLS) aiDraftsPending.value = []
	else detail.reload()
}, AI_DRAFT_POLL_MS)

watch(submissions, (rows) => {
	const graded = new Set(rows.filter((row) => row.grade).map((row) => row.name))
	aiDraftsPending.value = aiDraftsPending.value.filter((name) => !graded.has(name))
})

function clearSelection() {
	selection.value = []
	detail.reload()
}

async function copySubmissionLink() {
	const url = `${window.location.origin}/dashboard/assignments/${assignmentId.value}/submission`
	try {
		await navigator.clipboard.writeText(url)
		toast.success('Submission link copied.')
	} catch {
		toast.error('Could not copy link.')
	}
}

watch(
	() => assignment.value?.title,
	(title) => {
		breadcrumbs.set(
			title
				? [{ label: 'Assignments', route: '/faculty/assignments' }, { label: title }]
				: [],
		)
	},
	{ immediate: true },
)
</script>
