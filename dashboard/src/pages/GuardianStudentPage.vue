<template>
	<AppHeader title="Student">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/guardian" />
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
					<p
						v-if="overview.data && overview.data.average !== null"
						class="text-base text-ink-gray-8"
					>
						Average {{ averageLabel(overview.data) }}
					</p>
				</div>
			</div>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">Assignments</h2>

				<DataTable
					:columns="assignmentColumns"
					:rows="overview.data?.assignments ?? []"
					:row-key="(row: GuardianAssignment) => row.name"
					:row-height="60"
					:on-row-click="openGrade"
					empty="No assignments yet."
				>
					<template #cell-title="{ row }">
						<RowTitle :title="row.title">
							<template v-if="row.due_date">
								Due {{ formatDateTime(row.due_date) }}
							</template>
						</RowTitle>
					</template>

					<template #cell-status="{ row }">
						<Badge v-bind="statusOf(row)" variant="subtle" />
					</template>

					<template #cell-submitted="{ row }">
						<span v-if="row.submission" class="text-ink-gray-6">{{
							formatDateTime(row.submission.submitted_at)
						}}</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>

					<template #cell-grade="{ row }">
						<span v-if="row.grade" class="text-base font-medium text-ink-gray-8">
							{{ gradeLabel(row) }}
						</span>
						<span v-else class="text-ink-gray-5">—</span>
					</template>
				</DataTable>
			</section>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">Results</h2>

				<DataTable
					:columns="resultColumns"
					:rows="overview.data?.results ?? []"
					:row-key="(row: GuardianResult) => row.name"
					:row-height="60"
					empty="No results yet."
				>
					<template #cell-exam="{ row }">
						<RowTitle :title="row.exam_name">
							<template v-if="row.quarter" #default>{{ row.quarter }}</template>
						</RowTitle>
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
				</DataTable>
			</section>
		</div>
	</PageBody>

	<GradeDialog v-model:open="gradeOpen" :grade="activeGrade" />
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRefs, watch } from 'vue'
import { Avatar, Badge, PageHeaderBackButton, useCall } from 'frappe-ui'
import GradeDialog from '@/components/assignments/GradeDialog.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageBody from '@/components/common/PageBody.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatDateTime } from '@/lib/dates'
import { isRefusal } from '@/lib/frappeError'
import {
	averageLabel,
	gradeLabel,
	type GuardianAssignment,
	type GuardianChild,
} from '@/lib/guardian'
import { passTheme } from '@/lib/results'
import { assignmentStatus, assignmentStatusTheme, type AssignmentStatus } from '@/lib/status'
import type { CS17ResultSummary } from '@/types'

type GuardianResult = Omit<CS17ResultSummary, 'published_on'>

interface ChildOverview extends Pick<GuardianChild, 'average' | 'grade'> {
	student: GuardianChild
	assignments: GuardianAssignment[]
	results: GuardianResult[]
}

const STATUS_LABELS: Record<AssignmentStatus, string> = {
	Pending: 'Not submitted',
	Returned: 'Returned',
	Submitted: 'Submitted',
	Closed: 'Graded',
}

const props = defineProps<{ studentId: string }>()

const breadcrumbs = useBreadcrumbs()

const overview = useCall<ChildOverview, { student: string }>({
	url: '/api/v2/method/cs17_portal.guardian.get_child_overview',
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
	{ header: 'Status', key: 'status', width: '7.5rem' },
	{ header: 'Submitted', key: 'submitted', width: '8rem' },
	{ header: 'Grade', key: 'grade', width: '10rem' },
]

const resultColumns: Column[] = [
	{ header: 'Exam', key: 'exam', variant: 'primary' },
	{ header: 'Grade', key: 'grade', width: '6rem' },
	{ header: 'Result', key: 'result', width: '4.5rem' },
]

function statusOf(row: GuardianAssignment) {
	const status = assignmentStatus(row, row.submission, row.grade)
	if (status === 'Closed' && !row.grade) return { label: 'Missing', theme: 'red' } as const
	return { label: STATUS_LABELS[status], theme: assignmentStatusTheme(status) }
}

const gradeOpen = ref(false)
const gradedAssignment = ref<GuardianAssignment | null>(null)
const activeGrade = computed(() => gradedAssignment.value?.grade ?? null)

function openGrade(row: GuardianAssignment) {
	if (!row.grade) return
	gradedAssignment.value = row
	gradeOpen.value = true
}

watch(
	() => student.value?.full_name,
	(fullName) => {
		breadcrumbs.set(
			fullName ? [{ label: 'Dashboard', route: '/guardian' }, { label: fullName }] : [],
		)
	},
	{ immediate: true },
)
</script>
