<template>
	<AppHeader :title="assignment?.title ?? 'Assignment'">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/assignments" />
		</template>
	</AppHeader>

	<PageBody width="narrow">
		<LoadError
			v-if="failed"
			title="Could not load this assignment"
			:loading="assignmentCall.loading"
			@retry="assignmentCall.reload()"
		/>

		<PageSkeleton v-else-if="loading" :blocks="2" />

		<p v-else-if="!assignment" class="text-p-base text-ink-gray-5">Assignment not found.</p>

		<div v-else class="flex flex-col gap-6 md:flex-row">
			<h1 class="order-first break-words text-2xl text-ink-gray-9 md:sr-only">
				{{ assignment.title }}
			</h1>
			<div class="min-w-0 flex-1">
				<MarkdownText
					:content="assignment.description"
					:fallback="
						assignment.time_limit && !assignment.started_at
							? 'You will see the question when you start.'
							: undefined
					"
				/>
				<section v-if="revisions.data?.length" class="mt-6">
					<h2 class="text-base-medium text-ink-gray-8">Earlier attempts</h2>
					<SubmissionRevisions
						class="mt-2"
						:revisions="revisions.data"
						:evaluation-type="assignment.remarks"
						:max-marks="assignment.max_marks"
					/>
				</section>
			</div>

			<!-- The meta panel: everything about the assignment that is a value
			     rather than prose, plus the one action the student can take. -->
			<div
				class="order-first w-full shrink-0 space-y-3 rounded-4 border border-outline-gray-1 p-4 md:order-none md:w-64 md:self-start"
			>
				<div v-if="assignment.due_date">
					<p class="text-xs text-ink-gray-5">Due</p>
					<p
						:class="
							isOverdue ? 'text-base text-ink-red-6' : 'text-base text-ink-gray-8'
						"
					>
						{{ formatDateTime(assignment.due_date) }}
					</p>
				</div>

				<div>
					<p class="text-xs text-ink-gray-5">Evaluation Type</p>
					<p class="text-base text-ink-gray-8">{{ evaluationType }}</p>
				</div>

				<div v-if="evaluationType === 'Marks'">
					<p class="text-xs text-ink-gray-5">Max Marks</p>
					<p class="text-base text-ink-gray-8">{{ assignment.max_marks }}</p>
				</div>

				<div v-if="assignment.time_limit">
					<p class="text-xs text-ink-gray-5">Time Limit</p>
					<p class="text-base text-ink-gray-8">{{ assignment.time_limit }} min</p>
				</div>

				<template v-if="submission">
					<div>
						<p class="text-xs text-ink-gray-5">Submitted</p>
						<p class="text-base text-ink-green-6">
							{{ formatDateTime(submission.submitted_at) }}
						</p>
					</div>

					<div v-if="submission.returned_on">
						<p class="text-xs text-ink-gray-5">Sent back</p>
						<p class="text-base text-ink-amber-6">
							{{ formatDateTime(submission.returned_on) }}
						</p>
						<p
							v-if="revisions.data?.[0]"
							class="mt-1 whitespace-pre-line text-p-sm text-ink-gray-8"
							dir="auto"
						>
							{{ revisions.data[0].reason }}
						</p>
					</div>

					<Button
						v-if="!isClosed && !grade"
						class="w-full"
						:label="submission.returned_on ? 'Submit again' : 'Edit Submission'"
						@click="openSubmit"
					/>

					<template v-if="grade">
						<div v-if="!isLetterGrade && grade.grade">
							<p class="text-xs text-ink-gray-5">Grade</p>
							<p class="text-lg text-ink-gray-9">{{ grade.grade }}</p>
						</div>
						<div v-if="grade.evaluation_type">
							<p class="text-xs text-ink-gray-5">
								{{ isLetterGrade ? 'Grade' : 'Marks Obtained' }}
							</p>
							<p class="text-lg text-ink-gray-9">{{ score }}</p>
						</div>
						<div v-if="grade.remarks">
							<p class="text-xs text-ink-gray-5">Remarks</p>
							<MarkdownText class="mt-0.5" :content="grade.remarks" />
						</div>
					</template>
				</template>

				<p v-else-if="isClosed" class="text-sm text-ink-gray-5">
					{{ isOverdue ? 'Deadline passed' : 'Time is up' }}
				</p>
				<Button
					v-else
					class="w-full"
					:label="
						isProjectSubmission(assignment.submission_type)
							? 'Start'
							: 'Submit Assignment'
					"
					@click="openSubmit"
				/>

				<Button
					v-if="isClosed && assignment.next_attempt"
					class="w-full"
					label="Reattempt"
					@click="python.reattempt(assignment)"
				/>

				<div v-if="myAnswers.data" class="space-y-2 border-t border-outline-gray-1 pt-3">
					<div>
						<p class="text-xs text-ink-gray-5">Answers</p>
						<p
							v-if="answerCounts(myAnswers.data.answers)"
							class="text-base text-ink-gray-8"
						>
							{{ answerCounts(myAnswers.data.answers) }}
						</p>
					</div>
					<Button class="w-full" label="View answers" @click="answersOpen = true" />
				</div>
			</div>
		</div>

		<AnswersDialog
			v-if="myAnswers.data"
			v-model:open="answersOpen"
			title="Answers"
			:answers="myAnswers.data.answers"
			:summary="myAnswers.data.summary"
			:note="myAnswers.data.note"
		/>

		<SubmitAssignmentDialog
			v-if="assignment"
			v-model:open="submitOpen"
			:assignment="assignment"
			:existing-submission="submission"
			@success="onSubmitted"
		/>
	</PageBody>
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRefs, watch } from 'vue'
import { Button, PageHeaderBackButton, useCall, useList } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import LoadError from '@/components/common/LoadError.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import AnswersDialog from '@/components/answers/AnswersDialog.vue'
import SubmissionRevisions from '@/components/assignments/SubmissionRevisions.vue'
import SubmitAssignmentDialog from '@/components/assignments/SubmitAssignmentDialog.vue'
import { usePythonAssignment } from '@/components/assignments/pythonEditor'
import { useScratchAssignment } from '@/components/assignments/scratchEditor'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { useSession } from '@/composables/useSession'
import { answerCounts } from '@/lib/answers'
import { formatDateTime, isPast } from '@/lib/dates'
import { isRefusal } from '@/lib/frappeError'
import { isProjectSubmission } from '@/lib/submissionTypes'
import type {
	AnswerSummary,
	CS17Assignment,
	CS17Submission,
	StudentAnswer,
	StudentGradesResponse,
	SubmissionRevision,
} from '@/types'

const props = defineProps<{ assignmentId: string }>()

const { profile } = useSession()
const breadcrumbs = useBreadcrumbs()
const scratch = useScratchAssignment()
const python = usePythonAssignment()

const assignmentCall = useCall<CS17Assignment, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_assignment',
	params: () => ({ assignment: props.assignmentId }),
	refetch: true,
})

const submissions = useList<CS17Submission>({
	doctype: 'CS17 Assignment Submission',
	fields: [
		'name',
		'student',
		'assignment',
		'submitted_at',
		'submission_url',
		'project',
		'returned_on',
	],
	filters: () => ({ student: profile.value?.name ?? '', assignment: props.assignmentId }),
	limit: 1,
	immediate: Boolean(profile.value?.name),
})

const gradesCall = useCall<StudentGradesResponse>({
	url: '/api/v2/method/cs17_portal.api.get_student_grades',
})

const loadedId = ref('')
watch(
	() => assignmentCall.data,
	() => {
		loadedId.value = props.assignmentId
	},
)

const assignment = computed(() =>
	loadedId.value === props.assignmentId ? assignmentCall.data : null,
)
const loading = computed(() => assignmentCall.loading && !assignment.value)
const failed = useLoadFailed(reactive({ ...toRefs(assignmentCall), data: assignment }), {
	except: isRefusal,
})
const submissionsLoadedId = ref('')
watch(
	() => submissions.data,
	() => {
		submissionsLoadedId.value = props.assignmentId
	},
)

const submission = computed(() =>
	submissionsLoadedId.value === props.assignmentId ? (submissions.data?.[0] ?? null) : null,
)

/**
 * Only the grade written against this student's own submission counts — the
 * endpoint answers with every grade they may see, across assignments.
 */
const grade = computed(
	() => gradesCall.data?.grades.find((row) => row.submission === submission.value?.name) ?? null,
)

const isLetterGrade = computed(() => grade.value?.evaluation_type === 'Grade')
const score = computed(() => {
	const value = isLetterGrade.value ? grade.value?.grade : grade.value?.marks_obtained
	return value === null || value === undefined ? '—' : String(value)
})

const isOverdue = computed(() => isPast(assignment.value?.due_date))
const isClosed = computed(
	() => !submission.value?.returned_on && (isOverdue.value || isPast(assignment.value?.ends_at)),
)

const revisions = useCall<SubmissionRevision[], { submission: string }>({
	url: '/api/v2/method/cs17_portal.api.get_submission_revisions',
	params: () => ({ submission: submission.value?.name ?? '' }),
	immediate: false,
})

watch(
	() => submission.value?.name,
	(name) => {
		if (name) revisions.reload()
	},
	{ immediate: true },
)

/** `remarks` is the doctype's field for how a graded assignment is scored. */
const evaluationType = computed(() =>
	assignment.value?.assignment_type === 'Graded'
		? assignment.value.remarks || 'Graded'
		: 'Non-graded',
)

const submitOpen = ref(false)
const answersOpen = ref(false)

const myAnswers = useCall<
	{ answers: StudentAnswer[]; summary: AnswerSummary[]; note: string } | null,
	{ assignment: string }
>({
	url: '/api/v2/method/cs17_portal.answer_sheet.get_my_answers',
	params: () => ({ assignment: props.assignmentId }),
	refetch: true,
})

function openSubmit() {
	if (!assignment.value) return
	// Scratch work is done in the editor, so this row jumps there instead.
	if (assignment.value.submission_type === 'Scratch') {
		scratch.open(assignment.value, submission.value)
		return
	}
	if (assignment.value.submission_type === 'Python') {
		python.open(assignment.value)
		return
	}
	submitOpen.value = true
}

function onSubmitted() {
	submitOpen.value = false
	submissions.reload()
	gradesCall.reload()
}

watch(
	() => assignment.value?.title,
	(title) => {
		breadcrumbs.set(
			title ? [{ label: 'Assignments', route: '/assignments' }, { label: title }] : [],
		)
	},
	{ immediate: true },
)
</script>
