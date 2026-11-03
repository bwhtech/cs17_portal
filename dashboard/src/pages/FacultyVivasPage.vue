<template>
	<AppHeader title="Viva" />

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load vivas"
			:loading="vivasCall.loading"
			@retry="vivasCall.reload()"
		/>

		<DataTable
			v-else
			:columns="columns"
			:rows="vivasCall.data ?? []"
			:row-key="rowKey"
			:loading="vivasCall.loading && !vivasCall.data"
			:row-height="60"
			:on-row-click="openViva"
			empty="No vivas yet."
		>
			<template #cell-viva="{ row }">
				<RowTitle :title="row.exam_name" :to="`/faculty/vivas/${row.name}`">
					{{ row.subject_name }} · {{ row.component }}
				</RowTitle>
			</template>

			<template #cell-marked="{ row }">{{ row.marked }} of {{ row.students }}</template>
		</DataTable>
	</PageBody>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import type { VivaSummary } from '@/lib/viva'

const router = useRouter()

const columns: Column[] = [
	{ header: 'Viva', key: 'viva', variant: 'primary' },
	{ header: 'Marked', key: 'marked', width: '7rem' },
]

const vivasCall = useCall<VivaSummary[]>({
	url: '/api/v2/method/cs17_portal.viva.get_vivas',
	method: 'GET',
})

const failed = useLoadFailed(vivasCall)

const rowKey = (row: VivaSummary) => row.name

function openViva(row: VivaSummary) {
	router.push(`/faculty/vivas/${row.name}`)
}
</script>
