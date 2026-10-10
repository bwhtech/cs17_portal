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
				<span class="truncate text-ink-gray-8">{{ row.full_name }}</span>
			</template>

			<template #cell-assignment_title="{ row }">
				<span class="truncate">{{ row.assignment_title }}</span>
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
				<Button :label="row.graded ? 'Review' : 'Grade'" @click.stop="openGrading(row)" />
			</template>
		</DataTable>
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import GradeBadge from '@/components/common/GradeBadge.vue'
import LoadError from '@/components/common/LoadError.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { formatDateTime } from '@/lib/dates'
import type { CohortSubmission } from '@/types'

const router = useRouter()

const columns: Column[] = [
	{ header: 'Student', key: 'full_name', variant: 'primary', width: '12rem' },
	{ header: 'Assignment', key: 'assignment_title' },
	{ header: 'Type', key: 'submission_type', width: '8rem' },
	{ header: 'Submitted', key: 'submitted_at', width: '11rem' },
	{ header: 'Grade', key: 'grade', width: '9rem' },
	{ header: '', key: 'actions', variant: 'actions', width: '7rem', align: 'right' },
]

const submissions = useCall<CohortSubmission[]>({
	url: '/api/v2/method/cs17_portal.api.list_cohort_submissions',
	method: 'GET',
	cacheKey: 'cohort-submissions',
})

const rows = computed(() => submissions.data ?? [])
const failed = useLoadFailed(submissions)

const rowKey = (row: CohortSubmission) => row.name

function openGrading(row: CohortSubmission) {
	router.push(`/faculty/submissions/${row.name}`)
}
</script>
