<template>
	<AppHeader title="Dashboard" />

	<PageBody width="narrow" class="space-y-6">
		<div>
			<h1 class="break-words text-2xl text-ink-gray-9">Welcome back, {{ firstName }}.</h1>
			<p class="mt-1 text-sm text-ink-gray-5">{{ today }}</p>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<DashboardCard v-if="liveExams.length" title="Live now" class="md:col-span-2">
				<div class="divide-y divide-outline-gray-1">
					<div
						v-for="exam in liveExams"
						:key="exam.name"
						class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
					>
						<div class="min-w-0">
							<p class="truncate text-base text-ink-gray-8" :title="exam.title">
								{{ exam.title }}
							</p>
							<p class="mt-1 text-sm text-ink-gray-5">
								Closes {{ formatDateTime(exam.closes_on) }}
							</p>
						</div>
						<Button
							class="shrink-0 self-start sm:self-auto"
							label="Watch live"
							icon-right="lucide-arrow-right"
							:route="`/faculty/exams/${exam.name}/live`"
						/>
					</div>
				</div>
			</DashboardCard>

			<DashboardCard
				title="Assigned to you"
				:error="assignedFailed ? 'Could not load your assigned submissions.' : undefined"
				:loading="assignedCall.loading && !assignedCall.data"
				:empty="assigned.length ? undefined : 'No submissions assigned to you yet.'"
			>
				<template #action>
					<Button
						v-if="total > assigned.length"
						:label="`View all (${total.toLocaleString()})`"
						route="/faculty/submissions?assigned=me"
					/>
				</template>

				<div class="divide-y divide-outline-gray-1">
					<div
						v-for="submission in assigned"
						:key="submission.name"
						class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
					>
						<div class="min-w-0">
							<p
								class="truncate text-base text-ink-gray-8"
								:title="submission.full_name"
							>
								{{ submission.full_name }}
							</p>
							<RouterLink
								:to="`/faculty/assignments/${submission.assignment}`"
								class="mt-1 block truncate rounded-1 text-sm text-ink-gray-5 hover:text-ink-gray-8 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
								:title="submission.assignment_title"
							>
								{{ submission.assignment_title }}
							</RouterLink>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<Badge
								v-if="submission.grade"
								label="Graded"
								theme="green"
								variant="subtle"
							/>
							<Button
								:label="submission.grade ? 'Edit grade' : 'Grade'"
								icon-right="lucide-arrow-right"
								:route="`/faculty/submissions/${submission.name}`"
							/>
						</div>
					</div>
				</div>
			</DashboardCard>

			<DashboardCard
				title="To grade"
				:error="dashboardFailed ? 'Could not load the submissions to grade.' : undefined"
				:loading="dashboardLoading"
				:empty="toGrade.total ? undefined : 'Nothing is waiting for a grade.'"
			>
				<template #action>
					<Badge
						v-if="toGrade.total"
						:label="toGrade.total.toLocaleString()"
						theme="amber"
						variant="subtle"
					/>
				</template>

				<div class="space-y-3">
					<ul class="divide-y divide-outline-gray-1">
						<li v-for="submission in toGrade.submissions" :key="submission.name">
							<RouterLink
								:to="`/faculty/submissions/${submission.name}`"
								class="-mx-2 block rounded-2 px-2 py-2.5 hover:bg-surface-gray-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
							>
								<span
									class="block truncate text-base text-ink-gray-8"
									:title="submission.full_name"
								>
									{{ submission.full_name }}
								</span>
								<span
									class="mt-1 block truncate text-sm text-ink-gray-5"
									:title="submission.assignment_title"
								>
									{{ submission.assignment_title }} ·
									{{ formatDateTime(submission.submitted_at) }}
								</span>
							</RouterLink>
						</li>
					</ul>
					<Button
						label="Open submissions"
						icon-right="lucide-arrow-right"
						route="/faculty/submissions"
					/>
				</div>
			</DashboardCard>

			<DashboardCard
				title="Due soon"
				class="md:col-span-2"
				:error="dashboardFailed ? 'Could not load the assignments due soon.' : undefined"
				:loading="dashboardLoading"
				:empty="dueSoon.length ? undefined : 'Nothing is due in the next 7 days.'"
			>
				<ul class="divide-y divide-outline-gray-1">
					<li
						v-for="assignment in dueSoon"
						:key="assignment.name"
						class="flex items-center justify-between gap-4 py-2.5"
					>
						<div class="min-w-0">
							<RouterLink
								:to="`/faculty/assignments/${assignment.name}`"
								class="block truncate rounded-1 text-base text-ink-gray-8 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
								:title="assignment.title"
							>
								{{ assignment.title }}
							</RouterLink>
							<p class="mt-1 text-sm text-ink-gray-5">
								Due {{ formatDateTime(assignment.due_date) }}
							</p>
						</div>
						<p class="shrink-0 text-sm tabular-nums text-ink-gray-7">
							{{ assignment.submitted }} of {{ assignment.total }} submitted
						</p>
					</li>
				</ul>
			</DashboardCard>
		</div>
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Badge, Button, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DashboardCard from '@/components/faculty/DashboardCard.vue'
import { useSession } from '@/composables/useSession'
import { formatDateTime, formatLongDate } from '@/lib/dates'
import type { CS17Submission, FacultyDashboard } from '@/types'

const { profile } = useSession()

const firstName = computed(() => profile.value?.full_name?.split(' ')[0] ?? 'Faculty')
const today = formatLongDate()

const assignedCall = useCall<{ submissions: CS17Submission[]; total: number }, { limit: number }>({
	url: '/api/v2/method/cs17_portal.api.get_assigned_submission_summary',
	params: { limit: 5 },
	cacheKey: 'assigned-submission-summary',
})

const total = computed(() => assignedCall.data?.total ?? 0)
const assigned = computed(() => assignedCall.data?.submissions ?? [])
const assignedFailed = computed(() => Boolean(assignedCall.error) && !assignedCall.data)

const dashboardCall = useCall<FacultyDashboard>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_dashboard',
	method: 'GET',
	cacheKey: 'faculty-dashboard',
})

const toGrade = computed(() => dashboardCall.data?.to_grade ?? { submissions: [], total: 0 })
const dueSoon = computed(() => dashboardCall.data?.due_soon ?? [])
const liveExams = computed(() => dashboardCall.data?.live_exams ?? [])
const dashboardLoading = computed(() => dashboardCall.loading && !dashboardCall.data)
const dashboardFailed = computed(() => Boolean(dashboardCall.error) && !dashboardCall.data)
</script>
