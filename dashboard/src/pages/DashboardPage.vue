<template>
	<AppHeader title="Dashboard" />

	<PageBody width="narrow" class="space-y-6">
		<div>
			<h1 class="break-words text-2xl text-ink-gray-9">Welcome back, {{ firstName }}.</h1>
			<p class="mt-1 text-sm text-ink-gray-5">{{ today }}</p>
		</div>

		<ExamCard v-for="exam in comingExams" :key="exam.name" :exam="exam" />

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
					class="shrink-0 rounded-2 text-xs text-ink-gray-5 hover:text-ink-gray-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				>
					View all →
				</RouterLink>
			</div>

			<ErrorMessage v-if="failed" message="Could not load upcoming assignments." />
			<AssignmentTable
				v-else-if="loading || upcoming.length"
				:assignments="upcoming"
				:submission-map="submissionMap"
				:grade-map="gradeMap"
				:loading="loading"
				@submitted="reloadSubmissionsAndGrades"
				@view-grade="openGrade"
			/>
			<p v-else class="text-p-xs text-ink-gray-5">
				{{ cohort ? 'No upcoming assignments.' : 'You are not in a cohort yet.' }}
			</p>
		</section>

		<TopicProgress
			:topics="topicProgressCall.data"
			:failed="topicProgressFailed"
			class="space-y-4 md:rounded-4 md:border md:border-outline-gray-1 md:bg-surface-base md:p-5"
		>
			<h2 class="text-base-medium text-ink-gray-8">By topic</h2>
		</TopicProgress>
	</PageBody>

	<GradeDialog v-model:open="gradeOpen" :grade="activeGrade" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ErrorMessage } from 'frappe-ui'
import AlertBanner from '@/components/announcements/AlertBanner.vue'
import AssignmentTable from '@/components/assignments/AssignmentTable.vue'
import GradeDialog from '@/components/assignments/GradeDialog.vue'
import ExamCard from '@/components/exams/ExamCard.vue'
import type { CodingExamSummary } from '@/components/exams/codingExam'
import TopicProgress, { type TopicProgressRow } from '@/components/reports/TopicProgress.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import { useAnnouncements } from '@/composables/useAnnouncements'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolledCall, usePolling, usePublishTimer } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import { dayjs, formatLongDate } from '@/lib/dates'
import { isRefusal } from '@/lib/frappeError'
import { gradesByAssignment, submissionsByAssignment } from '@/lib/status'
import type { StudentUpcomingAssignmentsResponse } from '@/types'

const { profile, cohort, isStudent } = useSession()
const { announcements } = useAnnouncements()

const firstName = computed(() => profile.value?.first_name || 'Student')
const today = formatLongDate()

const upcomingCall = usePolledCall<StudentUpcomingAssignmentsResponse>({
	url: '/api/v2/method/cs17_portal.api.get_student_upcoming_assignments',
	immediate: Boolean(cohort.value),
})

const topicProgressCall = usePolledCall<TopicProgressRow[]>({
	url: '/api/v2/method/cs17_portal.topic_progress.get_my_topic_progress',
	immediate: isStudent.value,
})

const examsCall = usePolledCall<CodingExamSummary[]>({
	url: '/api/v2/method/cs17_portal.coding_exam.get_my_coding_exams',
	immediate: isStudent.value,
})

usePolling(upcomingCall.reload)
usePolling(examsCall.reload)
usePublishTimer(() => upcomingCall.data?.next_publish_on, reloadSubmissionsAndGrades)

const comingExams = computed(() =>
	(examsCall.data ?? [])
		.filter((exam) => ['in_progress', 'open', 'upcoming'].includes(exam.state))
		.sort((a, b) => dayjs(a.opens_on).valueOf() - dayjs(b.opens_on).valueOf()),
)
const upcoming = computed(() => upcomingCall.data?.assignments ?? [])
const submissions = computed(() => upcoming.value.flatMap((row) => row.submission ?? []))

const submissionMap = computed(() => submissionsByAssignment(submissions.value))
/** §7: a grade is only the student's to see when it traces back to their own work. */
const gradeMap = computed(() =>
	gradesByAssignment(upcomingCall.data?.grades ?? [], submissions.value),
)

const loading = computed(() => upcomingCall.loading && !upcomingCall.data)

const failed = useLoadFailed(upcomingCall)
const topicProgressFailed = useLoadFailed(topicProgressCall, { except: isRefusal })

const gradeAssignment = ref<string | null>(null)
const gradeOpen = ref(false)
const activeGrade = computed(() =>
	gradeAssignment.value ? (gradeMap.value[gradeAssignment.value] ?? null) : null,
)

function openGrade(assignment: string) {
	gradeAssignment.value = assignment
	gradeOpen.value = true
}

function reloadSubmissionsAndGrades() {
	upcomingCall.reload()
	topicProgressCall.reload()
}
</script>
