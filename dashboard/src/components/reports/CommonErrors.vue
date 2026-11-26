<template>
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-ink-gray-8">Common errors</h2>
		<ErrorMessage v-if="failed" message="Could not load common errors." />
		<DataTable
			v-else
			:columns="columns"
			:rows="errors.data ?? []"
			:row-key="(row: CommonError) => `${row.assignment}:${row.error_type}:${row.error_line}`"
			:loading="loading || (Boolean(params.cohort) && !errors.data)"
			:group-by="(row: CommonError) => row.topic"
			:on-row-click="openLiveLab"
			empty="No errors in this cohort's runs."
		>
			<template #cell-error="{ row }">
				<RowTitle :title="errorAt(row)" />
			</template>
		</DataTable>
	</section>
</template>

<script setup lang="ts">
import { ErrorMessage, useCall } from 'frappe-ui'
import { useRouter } from 'vue-router'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'

interface CommonError {
	topic: string
	assignment: string
	title: string
	error_type: string
	error_line: number
	students: number
}

const props = defineProps<{
	params: { cohort: string; quarter?: string }
	loading?: boolean
}>()

const columns: Column[] = [
	{ header: 'Error', key: 'error', variant: 'primary' },
	{ header: 'Assignment', key: 'title' },
	{ header: 'Students', key: 'students', width: '6rem' },
]

const errors = useCall<CommonError[], { cohort: string; quarter?: string }>({
	url: '/api/v2/method/cs17_portal.common_errors.get_common_errors',
	method: 'GET',
	params: () => props.params,
	immediate: false,
	refetch: true,
})
const failed = useLoadFailed(errors)

const router = useRouter()

function openLiveLab(row: CommonError) {
	router.push({ name: 'FacultyLiveLab', params: { assignmentId: row.assignment } })
}

function errorAt(error: CommonError): string {
	return error.error_line ? `${error.error_type} on line ${error.error_line}` : error.error_type
}
</script>
