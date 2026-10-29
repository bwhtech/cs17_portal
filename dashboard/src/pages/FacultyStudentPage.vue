<template>
	<AppHeader title="Student">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/faculty/submissions" />
		</template>
	</AppHeader>

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load this student"
			:loading="overview.loading"
			@retry="overview.reload()"
		/>

		<PageSkeleton v-else-if="overview.loading && !student" />

		<EmptyState v-else-if="!student" icon="lucide-user-x" title="Student not found" />

		<div v-else class="space-y-6">
			<div class="flex items-center gap-4">
				<Avatar
					class="size-16 shrink-0"
					size="3xl"
					:image="student.profile_picture ?? undefined"
					:label="student.full_name"
				/>
				<div class="min-w-0">
					<h1 class="break-words text-2xl text-ink-gray-9 md:sr-only">
						{{ student.full_name }}
					</h1>
					<p class="text-base text-ink-gray-5">{{ student.cohort }}</p>
				</div>
			</div>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">Assignments</h2>

				<DataTable
					:columns="assignmentColumns"
					:rows="overview.data?.assignments ?? []"
					:row-key="(row: StudentOverviewAssignment) => row.name"
					:row-height="60"
					:on-row-click="openGrading"
					empty="No assignments yet."
				>
					<template #cell-title="{ row }">
						<RowTitle :title="row.title" :to="gradingRoute(row)">
							<template v-if="row.due_date">
								Due {{ formatDateTime(row.due_date) }} ·
							</template>
							{{ row.submission_type ?? 'Any' }}
						</RowTitle>
					</template>

					<template #cell-status="{ row }">
						<Badge
							v-if="row.submission?.returned_on"
							label="Returned"
							theme="amber"
							variant="subtle"
							:title="formatDateTime(row.submission.returned_on)"
						/>
						<Badge
							v-else
							:label="row.submission ? 'Submitted' : 'Not submitted'"
							:theme="row.submission ? 'green' : 'gray'"
							variant="subtle"
						/>
					</template>

					<template #cell-submitted="{ row }">
						<span v-if="row.submission?.submitted_at" class="text-ink-gray-6">{{
							formatDateTime(row.submission.submitted_at)
						}}</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-grade="{ row }">
						<span v-if="row.submission?.grade" class="flex items-center gap-2">
							<span
								v-if="row.assignment_type === 'Graded'"
								class="text-base font-medium text-ink-gray-8"
							>
								{{ gradeValue(row) }}
							</span>
							<Badge v-bind="publishStatus(row.submission.grade)" variant="subtle" />
						</span>
						<Badge
							v-else-if="row.submission && row.assignment_type === 'Graded'"
							label="Ungraded"
							theme="gray"
							variant="subtle"
						/>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-tab_leaves="{ row }">
						<span v-if="row.watch_tab_switches" class="text-ink-gray-7">{{
							row.tab_leave_count.toLocaleString()
						}}</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>
				</DataTable>
			</section>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">Results</h2>

				<DataTable
					:columns="resultColumns"
					:rows="overview.data?.results ?? []"
					:row-key="(row: StudentOverviewResult) => row.name"
					:row-height="60"
					empty="No results yet."
				>
					<template #cell-exam="{ row }">
						<RowTitle :title="row.exam_name">
							<template v-if="row.quarter" #default>{{ row.quarter }}</template>
						</RowTitle>
					</template>

					<template #cell-marks="{ row }">
						{{ formatMarks(row.total_marks_obtained, row.total_max_marks) }}
					</template>

					<template #cell-percentage="{ row }">
						{{ formatPercent(row.percentage) }}
					</template>

					<template #cell-grade="{ row }">
						<span class="text-base text-ink-gray-8">{{
							row.overall_grade || '—'
						}}</span>
					</template>

					<template #cell-result="{ row }">
						<Badge
							v-if="row.result_status"
							:label="row.result_status"
							:theme="passTheme(row.result_status === 'Pass')"
							variant="subtle"
						/>
					</template>

					<template #cell-status="{ row }">
						<div class="min-w-0 leading-tight">
							<Badge v-bind="resultStatus(row)" variant="subtle" />
							<div
								v-if="!row.is_published && row.published_on"
								class="mt-1.5 text-balance text-sm leading-tight text-ink-gray-5"
							>
								{{ formatDateTime(row.published_on) }}
							</div>
						</div>
					</template>
				</DataTable>
			</section>
		</div>
	</PageBody>
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRefs, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, Badge, PageHeaderBackButton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatDateTime, isPast } from '@/lib/dates'
import { isRefusal } from '@/lib/frappeError'
import { formatGrade } from '@/lib/grades'
import { formatMarks, formatPercent, passTheme } from '@/lib/results'
import type {
	CS17Grade,
	StudentOverview,
	StudentOverviewAssignment,
	StudentOverviewResult,
} from '@/types'

const props = defineProps<{ studentId: string }>()

const router = useRouter()
const breadcrumbs = useBreadcrumbs()

const overview = useCall<StudentOverview, { student: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_overview',
	params: () => ({ student: props.studentId }),
	refetch: true,
})

const loadedId = ref('')
watch(
	() => overview.data,
	() => {
		loadedId.value = props.studentId
	},
)

const student = computed(() =>
	loadedId.value === props.studentId ? (overview.data?.student ?? null) : null,
)
const failed = useLoadFailed(reactive({ ...toRefs(overview), data: student }), {
	except: isRefusal,
})

const assignmentColumns: Column[] = [
	{ header: 'Assignment', key: 'title', variant: 'primary' },
	{ header: 'Status', key: 'status', width: '6.5rem' },
	{ header: 'Submitted', key: 'submitted', width: '8rem' },
	{ header: 'Grade', key: 'grade', width: '10rem' },
	{ header: 'Tab leaves', key: 'tab_leaves', width: '5.5rem' },
]

const resultColumns: Column[] = [
	{ header: 'Exam', key: 'exam', variant: 'primary' },
	{ header: 'Marks', key: 'marks', width: '8rem' },
	{ header: 'Percentage', key: 'percentage', width: '5.5rem' },
	{ header: 'Grade', key: 'grade', width: '6rem' },
	{ header: 'Result', key: 'result', width: '4.5rem' },
	{ header: 'Status', key: 'status', width: '7.5rem' },
]

function gradingRoute(row: StudentOverviewAssignment): string | undefined {
	return row.submission ? `/faculty/submissions/${row.submission.name}` : undefined
}

function openGrading(row: StudentOverviewAssignment) {
	const route = gradingRoute(row)
	if (route) router.push(route)
}

function gradeValue(row: StudentOverviewAssignment): string {
	return formatGrade({
		evaluationType: row.remarks,
		grade: row.submission?.grade?.grade,
		marksObtained: row.submission?.grade?.marks_obtained,
		maxMarks: row.max_marks,
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

function resultStatus(result: StudentOverviewResult) {
	if (result.is_published) return { label: 'Published', theme: 'green' } as const
	if (result.published_on) return { label: 'Scheduled', theme: 'amber' } as const
	return { label: 'Draft', theme: 'gray' } as const
}

watch(
	() => student.value?.full_name,
	(fullName) => {
		breadcrumbs.set(
			fullName
				? [{ label: 'Submissions', route: '/faculty/submissions' }, { label: fullName }]
				: [],
		)
	},
	{ immediate: true },
)
</script>
