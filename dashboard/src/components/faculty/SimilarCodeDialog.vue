<template>
	<Dialog :open="open" :title="title" size="2xl" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<p class="text-p-sm text-ink-gray-5">
				Comments, spacing and the starter code do not count.
			</p>

			<LoadError
				v-if="failed"
				title="Could not compare the submissions"
				:loading="loading"
				@retry="emit('retry')"
			/>

			<DataTable
				v-else
				:columns="columns"
				:rows="rows"
				:row-key="(pair: SimilarPair) => pair.submissions.map((row) => row.name).join()"
				:loading="loading && !pairs"
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
import { computed } from 'vue'
import { Dialog } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import type { PairedSubmission, SimilarPair } from '@/types'

const props = defineProps<{
	open: boolean
	pairs: SimilarPair[] | null
	loading: boolean
	failed: boolean
	submission?: PairedSubmission
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; retry: [] }>()

const title = computed(() =>
	props.submission ? `Similar code: ${studentName(props.submission)}` : 'Similar code',
)

const rows = computed(() =>
	(props.pairs ?? []).flatMap((pair): SimilarPair[] => {
		const [first, second] = pair.submissions
		if (!props.submission || first.name === props.submission.name) return [pair]
		if (second.name === props.submission.name)
			return [{ ...pair, submissions: [second, first] }]
		return []
	}),
)

const columns = computed<Column[]>(() => [
	...(props.submission
		? []
		: [{ header: 'Student', key: 'student', variant: 'primary' as const }]),
	{ header: 'Similar to', key: 'other', variant: props.submission ? 'primary' : 'field' },
	{ header: 'Similarity', key: 'similarity', width: '6rem', align: 'right' },
])

function studentName(submission: PairedSubmission): string {
	return submission.full_name ?? submission.student
}
</script>
