<template>
	<AppHeader :title="assignment?.title ?? 'Assignment'">
		<template #left-mobile>
			<PageHeaderBackButton to="/assignments" />
		</template>
	</AppHeader>

	<div class="px-3 py-5 pb-10 sm:px-5">
		<PageSkeleton v-if="loading" :blocks="2" />

		<p v-else-if="!assignment" class="text-p-base text-ink-gray-5">Assignment not found.</p>

		<div v-else class="flex flex-col gap-6 md:flex-row">
			<div class="min-w-0 flex-1">
				<h1 class="mb-4 text-2xl text-ink-gray-9">{{ assignment.title }}</h1>
				<MarkdownText :content="assignment.description" />
			</div>

			<!-- The meta panel: everything about the assignment that is a value
			     rather than prose, plus the one action the student can take. -->
			<div
				class="w-full shrink-0 space-y-3 rounded-4 border border-outline-gray-1 p-4 md:w-64"
			>
				<div>
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

				<template v-if="submission">
					<div>
						<p class="text-xs text-ink-gray-5">Submitted</p>
						<p class="text-base text-ink-green-6">
							{{ formatDateTime(submission.submitted_at) }}
						</p>
					</div>

					<Button
						v-if="!isOverdue && !grade"
						class="w-full"
						variant="outline"
						label="Edit Submission"
						@click="openSubmit"
					/>

					<template v-if="grade">
						<div>
							<p class="text-xs text-ink-gray-5">
								{{ isLetterGrade ? 'Grade' : 'Marks Obtained' }}
							</p>
							<p class="text-lg text-ink-gray-9">{{ score }}</p>
						</div>
						<div v-if="grade.remarks">
							<p class="text-xs text-ink-gray-5">Remarks</p>
							<p class="mt-0.5 text-p-base text-ink-gray-8">{{ grade.remarks }}</p>
						</div>
					</template>
				</template>

				<Button
					v-else
					class="w-full"
					variant="outline"
					:disabled="isOverdue"
					:label="isOverdue ? 'Deadline Passed' : 'Submit Assignment'"
					@click="openSubmit"
				/>
			</div>
		</div>

		<SubmitAssignmentDialog
			v-if="assignment"
			v-model:open="submitOpen"
			:assignment="assignment"
			:existing-submission="submission"
			@success="onSubmitted"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, PageHeaderBackButton, useCall, useDoc, useList } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import SubmitAssignmentDialog from '@/components/assignments/SubmitAssignmentDialog.vue'
import { useScratchAssignment } from '@/components/assignments/scratchEditor'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useSession } from '@/composables/useSession'
import { formatDateTime, isPast } from '@/lib/dates'
import type { CS17Assignment, CS17Submission, StudentGradesResponse } from '@/types'

const props = defineProps<{ assignmentId: string }>()

const { profile } = useSession()
const breadcrumbs = useBreadcrumbs()
const scratch = useScratchAssignment()

const assignmentDoc = useDoc<CS17Assignment>({
	doctype: 'CS17 Assignment',
	name: () => props.assignmentId,
})

const submissions = useList<CS17Submission>({
	doctype: 'CS17 Assignment Submission',
	fields: ['name', 'student', 'assignment', 'submitted_at', 'project'],
	filters: () => ({ student: profile.value?.name ?? '', assignment: props.assignmentId }),
	limit: 1,
	immediate: Boolean(profile.value?.name),
})

const gradesCall = useCall<StudentGradesResponse>({
	url: '/api/v2/method/cs17_portal.api.get_student_grades',
})

const assignment = computed(() => assignmentDoc.doc)
const loading = computed(() => assignmentDoc.loading && !assignmentDoc.doc)
const submission = computed(() => submissions.data?.[0] ?? null)

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

/** `remarks` is the doctype's field for how a graded assignment is scored. */
const evaluationType = computed(() =>
	assignment.value?.assignment_type === 'Graded'
		? (assignment.value.remarks ?? 'Graded')
		: 'Non-graded',
)

const submitOpen = ref(false)

function openSubmit() {
	if (!assignment.value) return
	// Scratch work is done in the editor, so this row jumps there instead.
	if (assignment.value.submission_type === 'Scratch') {
		scratch.open(assignment.value, submission.value)
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
		if (!title) return
		breadcrumbs.set([{ label: 'Assignments', route: '/assignments' }, { label: title }])
	},
	{ immediate: true },
)
</script>
