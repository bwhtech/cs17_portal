<template>
	<AppHeader title="Assignments" />

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load your assignments"
			@retry="assignmentsCall.reload()"
		/>

		<AssignmentTable
			v-else
			:assignments="assignments"
			:submission-map="submissionMap"
			:grade-map="gradeMap"
			:loading="loading"
			@submitted="reloadSubmissions"
			@view-grade="gradeAssignment = $event"
		/>

		<GradeDialog v-model:open="gradeOpen" :grade="activeGrade" />
	</PageBody>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCall, useList } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import LoadError from '@/components/common/LoadError.vue'
import AssignmentTable from '@/components/assignments/AssignmentTable.vue'
import GradeDialog from '@/components/assignments/GradeDialog.vue'
import { usePolling, usePublishTimer } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import { gradesByAssignment, submissionsByAssignment } from '@/lib/status'
import type { CS17Submission, StudentAssignmentsResponse, StudentGradesResponse } from '@/types'

const { profile, cohort } = useSession()

const assignmentsCall = useCall<StudentAssignmentsResponse, { cohort: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_assignments',
	params: () => ({ cohort: cohort.value ?? '' }),
	immediate: Boolean(cohort.value),
})

const gradesCall = useCall<StudentGradesResponse>({
	url: '/api/v2/method/cs17_portal.api.get_student_grades',
})

const submissions = useList<CS17Submission>({
	doctype: 'CS17 Assignment Submission',
	fields: [
		'name',
		'student',
		'assignment',
		'submitted_at',
		'submission_document',
		'submission_url',
		'project',
	],
	filters: () => ({ student: profile.value?.name ?? '' }),
	limit: 100,
	immediate: Boolean(profile.value?.name),
})

const assignments = computed(() => assignmentsCall.data?.assignments ?? [])
const submissionMap = computed(() => submissionsByAssignment(submissions.data ?? []))
const gradeMap = computed(() =>
	gradesByAssignment(gradesCall.data?.grades ?? [], submissions.data ?? []),
)

const loading = computed(() => assignmentsCall.loading && !assignmentsCall.data)
const failed = computed(() => Boolean(assignmentsCall.error) && !assignmentsCall.data)

// Both lists move together: an assignment that publishes on a schedule and the
// grade that lands on it are equally invisible until something reloads them.
function reloadPublished() {
	assignmentsCall.reload()
	gradesCall.reload()
}

usePolling(reloadPublished)
usePublishTimer(
	() => assignmentsCall.data?.next_publish_on,
	() => assignmentsCall.reload(),
)
usePublishTimer(
	() => gradesCall.data?.next_publish_on,
	() => gradesCall.reload(),
)

function reloadSubmissions() {
	submissions.reload()
	gradesCall.reload()
}

const gradeAssignment = ref<string | null>(null)
const activeGrade = computed(() =>
	gradeAssignment.value ? (gradeMap.value[gradeAssignment.value] ?? null) : null,
)

const gradeOpen = computed({
	get: () => Boolean(gradeAssignment.value),
	set: (value: boolean) => {
		if (!value) gradeAssignment.value = null
	},
})

// A grade that disappears (unpublished while the dialog is open) leaves the
// dialog showing a stale score, so close it instead.
watch(activeGrade, (grade) => {
	if (gradeAssignment.value && !grade) gradeAssignment.value = null
})
</script>
