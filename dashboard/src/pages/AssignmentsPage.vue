<template>
	<AppHeader title="Assignments" />

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load your assignments"
			:loading="assignmentsCall.loading"
			@retry="assignmentsCall.reload()"
		/>

		<AssignmentTable
			v-else
			:assignments="assignments"
			:submission-map="submissionMap"
			:grade-map="gradeMap"
			:loading="loading"
			@submitted="reloadPublished"
			@view-grade="gradeAssignment = $event"
		/>

		<GradeDialog v-model:open="gradeOpen" :grade="activeGrade" />
	</PageBody>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import LoadError from '@/components/common/LoadError.vue'
import AssignmentTable from '@/components/assignments/AssignmentTable.vue'
import GradeDialog from '@/components/assignments/GradeDialog.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolling, usePublishTimer } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import { gradesByAssignment, submissionsByAssignment } from '@/lib/status'
import type { StudentAssignmentsResponse, StudentGradesResponse } from '@/types'

const { cohort } = useSession()

const assignmentsCall = useCall<StudentAssignmentsResponse>({
	url: '/api/v2/method/cs17_portal.api.get_student_assignments',
	immediate: Boolean(cohort.value),
})

const gradesCall = useCall<StudentGradesResponse>({
	url: '/api/v2/method/cs17_portal.api.get_student_grades',
})

const assignments = computed(() => assignmentsCall.data?.assignments ?? [])
const submissions = computed(() => assignments.value.flatMap((row) => row.submission ?? []))
const submissionMap = computed(() => submissionsByAssignment(submissions.value))
const gradeMap = computed(() =>
	gradesByAssignment(gradesCall.data?.grades ?? [], submissions.value),
)

const loading = computed(() => assignmentsCall.loading && !assignmentsCall.data)
const failed = useLoadFailed(assignmentsCall)

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
