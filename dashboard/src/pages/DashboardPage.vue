<template>
	<AppHeader title="Dashboard" />

	<div class="space-y-6 px-3 py-5 pb-10 sm:px-5">
		<div>
			<h1 class="text-3xl text-ink-gray-9">Welcome back, {{ firstName }}.</h1>
			<p class="mt-1 text-p-sm text-ink-gray-5">{{ today }}</p>
		</div>

		<AlertBanner :announcements="announcements" />

		<!-- The card outline only earns its keep on a wide screen; below `md`
		     the rows already read as cards of their own. -->
		<section
			class="space-y-4 md:rounded-4 md:border md:border-outline-gray-1 md:bg-surface-base md:p-5"
		>
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-base-medium text-ink-gray-8">Upcoming assignments</h2>
				<RouterLink
					to="/assignments"
					class="shrink-0 text-xs text-ink-gray-5 hover:text-ink-gray-8"
				>
					View all →
				</RouterLink>
			</div>

			<AssignmentTable
				v-if="loading || upcoming.length"
				:assignments="upcoming"
				:submission-map="submissionMap"
				:grade-map="gradeMap"
				:loading="loading"
				@submitted="reloadSubmissionsAndGrades"
				@view-grade="gradeAssignment = $event"
			/>
			<p v-else class="text-p-xs text-ink-gray-5">No upcoming assignments.</p>
		</section>
	</div>

	<GradeDialog v-model:open="gradeOpen" :grade="activeGrade" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCall, useList } from 'frappe-ui'
import AlertBanner from '@/components/announcements/AlertBanner.vue'
import AssignmentTable from '@/components/assignments/AssignmentTable.vue'
import GradeDialog from '@/components/assignments/GradeDialog.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { usePolling, usePublishTimer } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import { dayjs, formatLongDate } from '@/lib/dates'
import { gradesByAssignment, submissionsByAssignment } from '@/lib/status'
import type {
	CS17Submission,
	StudentAnnouncementsResponse,
	StudentAssignmentsResponse,
	StudentGradesResponse,
} from '@/types'

/** The dashboard shows the next few pieces of work, not the whole list. */
const UPCOMING_LIMIT = 3

const { profile, cohort } = useSession()

const firstName = computed(() => profile.value?.full_name?.split(' ')[0] ?? 'Student')
const today = formatLongDate()

const announcementsCall = useCall<StudentAnnouncementsResponse, { cohort: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_announcements',
	params: () => ({ cohort: cohort.value ?? '' }),
	immediate: Boolean(cohort.value),
})

const assignmentsCall = useCall<StudentAssignmentsResponse, { cohort: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_assignments',
	params: () => ({ cohort: cohort.value ?? '' }),
	immediate: Boolean(cohort.value),
})

const gradesCall = useCall<StudentGradesResponse>({
	url: '/api/v2/method/cs17_portal.api.get_student_grades',
	immediate: Boolean(profile.value?.name),
})

const submissionsList = useList<CS17Submission>({
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

// Each student endpoint answers with the next scheduled publish beside its
// rows, so a publish lands on the second; the interval covers everything else.
for (const handle of [announcementsCall, assignmentsCall, gradesCall]) {
	usePolling(handle.reload)
}
usePublishTimer(() => announcementsCall.data?.next_publish_on, announcementsCall.reload)
usePublishTimer(() => assignmentsCall.data?.next_publish_on, assignmentsCall.reload)
usePublishTimer(() => gradesCall.data?.next_publish_on, gradesCall.reload)

const announcements = computed(() => announcementsCall.data?.announcements ?? [])
const assignments = computed(() => assignmentsCall.data?.assignments ?? [])
const submissions = computed(() => submissionsList.data ?? [])

const submissionMap = computed(() => submissionsByAssignment(submissions.value))
/** §7: a grade is only the student's to see when it traces back to their own work. */
const gradeMap = computed(() =>
	gradesByAssignment(gradesCall.data?.grades ?? [], submissions.value),
)

/** Still open, most recently touched first — the same three the React app showed. */
const upcoming = computed(() =>
	assignments.value
		.filter((a) => !dayjs(a.due_date).isBefore(dayjs()))
		.sort((a, b) => dayjs(b.modified).valueOf() - dayjs(a.modified).valueOf())
		.slice(0, UPCOMING_LIMIT),
)

const loading = computed(
	() =>
		(assignmentsCall.loading && !assignmentsCall.data) ||
		(submissionsList.loading && !submissionsList.data),
)

const gradeAssignment = ref<string | null>(null)
const activeGrade = computed(() =>
	gradeAssignment.value ? (gradeMap.value[gradeAssignment.value] ?? null) : null,
)
// Open is derived from "which assignment", so the dialog has exactly one
// source of truth and closing cannot leave a stale grade behind it.
const gradeOpen = computed({
	get: () => Boolean(gradeAssignment.value),
	set: (value: boolean) => {
		if (!value) gradeAssignment.value = null
	},
})

function reloadSubmissionsAndGrades() {
	submissionsList.reload()
	gradesCall.reload()
}
</script>
