<template>
	<AppHeader title="Submissions" />

	<PageBody>
		<p class="mb-5 text-sm text-ink-gray-5">
			Open, run, and grade submissions from your cohort.
		</p>

		<LoadError
			v-if="failed"
			title="Could not load submissions"
			:loading="submissions.loading"
			@retry="submissions.reload()"
		/>

		<DataTable
			v-else
			:columns="columns"
			:rows="rows"
			:row-key="rowKey"
			:loading="submissions.loading && !submissions.data"
			:on-row-click="openGrading"
			empty="No submissions yet."
		>
			<template #cell-full_name="{ row }">
				<RowTitle
					:title="row.full_name"
					:to="`/faculty/students/${row.student}`"
					@click.stop
				/>
			</template>

			<template #cell-assignment_title="{ row }">
				<span class="block truncate" :title="row.assignment_title">{{
					row.assignment_title
				}}</span>
			</template>

			<template #cell-submission_type="{ row }">
				<Badge
					v-if="row.submission_type"
					:label="row.submission_type"
					theme="gray"
					variant="subtle"
				/>
				<span v-else class="text-ink-gray-4">—</span>
			</template>

			<template #cell-submitted_at="{ row }">
				{{ formatDateTime(row.submitted_at) || '—' }}
			</template>

			<template #cell-grade="{ row }">
				<GradeBadge
					:graded="row.graded"
					:evaluation-type="row.evaluation_type"
					:marks-obtained="row.marks_obtained"
					:grade="row.grade"
					:max-marks="row.max_marks"
				/>
			</template>

			<!-- The whole row opens the workspace; this is the affordance that
			     says so, and names what the grader is walking into. -->
			<template #cell-actions="{ row }">
				<Button :label="openLabel(row)" @click.stop="openGrading(row)" />
			</template>
		</DataTable>

		<div v-if="hasNextPage && !failed" class="mt-4 flex justify-center">
			<Button
				label="Load more"
				icon-left="lucide-refresh-cw"
				:loading="submissions.loading"
				@click="limit += PAGE_LENGTH"
			/>
		</div>
	</PageBody>
</template>

<script lang="ts">
import { ref } from 'vue'

const PAGE_LENGTH = 20
// Outside setup, so coming back from grading keeps the pages already loaded.
const limit = ref(PAGE_LENGTH)
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import GradeBadge from '@/components/common/GradeBadge.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatDateTime } from '@/lib/dates'
import type { CohortSubmission } from '@/types'

const router = useRouter()

const columns: Column[] = [
	{ header: 'Student', key: 'full_name', variant: 'primary', width: 'minmax(6rem,12rem)' },
	{ header: 'Assignment', key: 'assignment_title', width: 'minmax(6rem,1fr)' },
	{ header: 'Type', key: 'submission_type', width: 'minmax(4.5rem,8rem)' },
	{ header: 'Submitted', key: 'submitted_at', width: 'minmax(8rem,11rem)' },
	{ header: 'Grade', key: 'grade', width: 'minmax(8.5rem,9rem)' },
	{ header: '', key: 'actions', variant: 'actions', width: '5rem', align: 'right' },
]

const submissions = useCall<CohortSubmission[], { limit: number }>({
	url: '/api/v2/method/cs17_portal.api.list_cohort_submissions',
	method: 'GET',
	params: () => ({ limit: limit.value }),
	refetch: true,
	cacheKey: 'cohort-submissions',
})

// While a request runs, `data` falls back to the rows cached when the page
// opened, so Load more would briefly show fewer rows.
const rows = computed<CohortSubmission[]>((previous) =>
	submissions.loading && previous?.length ? previous : (submissions.data ?? []),
)
const hasNextPage = computed<boolean>((previous = false) =>
	submissions.loading || submissions.error ? previous : rows.value.length >= limit.value,
)
const failed = useLoadFailed(submissions)

const rowKey = (row: CohortSubmission) => row.name

function openLabel(row: CohortSubmission): string {
	if (!row.evaluation_type) return 'Open'
	return row.graded ? 'Review' : 'Grade'
}

function openGrading(row: CohortSubmission) {
	router.push(`/faculty/submissions/${row.name}`)
}
</script>
