<template>
	<Dialog :open="open" title="Similar code" size="2xl" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<p class="text-p-sm text-ink-gray-5">
				Comments, spacing and the starter code do not count.
			</p>

			<LoadError
				v-if="failed"
				title="Could not compare the submissions"
				:loading="similar.loading"
				@retry="similar.reload()"
			/>

			<DataTable
				v-else
				:columns="columns"
				:rows="similar.data ?? []"
				:row-key="(pair: SimilarPair) => pair.submissions.map((row) => row.name).join()"
				:loading="similar.loading && !similar.data"
				empty="No similar submissions."
			>
				<template #cell-student="{ row }">
					<RowTitle
						:title="studentName(row.submissions[0])"
						:to="`/faculty/submissions/${row.submissions[0].name}`"
					/>
				</template>
				<template #cell-other="{ row }">
					<RowTitle
						:title="studentName(row.submissions[1])"
						:to="`/faculty/submissions/${row.submissions[1].name}`"
					/>
				</template>
				<template #cell-similarity="{ row }">
					<span class="text-ink-gray-8">{{ Math.round(row.similarity * 100) }}%</span>
				</template>
			</DataTable>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog, useCall } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import type { CS17Submission } from '@/types'

type PairedSubmission = Pick<CS17Submission, 'name' | 'student' | 'full_name'>

interface SimilarPair {
	similarity: number
	submissions: [PairedSubmission, PairedSubmission]
}

const props = defineProps<{ open: boolean; assignment: string }>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const similar = useCall<SimilarPair[], { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.get_similar_submissions',
	params: () => ({ assignment: props.assignment }),
})

const failed = useLoadFailed(similar)

const columns: Column[] = [
	{ header: 'Student', key: 'student', variant: 'primary' },
	{ header: 'Similar to', key: 'other' },
	{ header: 'Similarity', key: 'similarity', width: '6rem', align: 'right' },
]

function studentName(submission: PairedSubmission): string {
	return submission.full_name ?? submission.student
}
</script>
