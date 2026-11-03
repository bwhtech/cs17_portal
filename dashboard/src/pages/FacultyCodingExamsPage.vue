<template>
	<AppHeader title="Exams">
		<template #actions>
			<Button
				variant="solid"
				theme="gray"
				:icon-left="isDesktop ? 'lucide-plus' : undefined"
				:icon="isDesktop ? undefined : 'lucide-plus'"
				label="New exam"
				@click="formOpen = true"
			/>
		</template>
	</AppHeader>

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load exams"
			:loading="examsCall.loading"
			@retry="examsCall.reload()"
		/>

		<DataTable
			v-else
			:columns="columns"
			:rows="examsCall.data ?? []"
			:row-key="(row: CodingExamSummary) => row.name"
			:loading="examsCall.loading && !examsCall.data"
			:row-height="60"
			:on-row-click="(row: CodingExamSummary) => router.push(`/faculty/exams/${row.name}`)"
			empty="No coding exams yet."
		>
			<template #cell-title="{ row }">
				<RowTitle :title="row.title" :to="`/faculty/exams/${row.name}`">
					{{ formatMinutes(row.duration_minutes) }} · {{ row.cohort }}
					<template v-if="row.quarter"> · {{ row.quarter }}</template>
				</RowTitle>
			</template>

			<template #cell-window="{ row }">
				<span class="truncate text-ink-gray-7">{{
					formatExamWindow(row.opens_on, row.closes_on)
				}}</span>
			</template>

			<template #cell-state="{ row }">
				<Badge v-bind="EXAM_STATES[row.state]" variant="subtle" />
			</template>
		</DataTable>
	</PageBody>

	<CodingExamFormDialog
		v-model:open="formOpen"
		:cohorts="cohortsCall.data ?? []"
		:quarters="quartersCall.data ?? []"
		@saved="(exam) => router.push(`/faculty/exams/${exam}`)"
	/>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import CodingExamFormDialog from '@/components/exams/faculty/CodingExamFormDialog.vue'
import {
	EXAM_STATES,
	formatExamWindow,
	formatMinutes,
	type CodingExamSummary,
} from '@/components/exams/faculty/codingExam'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useLoadFailed } from '@/composables/useLoadFailed'

const router = useRouter()
const { isDesktop } = useBreakpoint()

const columns: Column[] = [
	{ header: 'Exam', key: 'title', variant: 'primary' },
	{ header: 'Window', key: 'window', width: '16rem' },
	{ header: 'Questions', key: 'question_count', width: '6rem' },
	{ header: 'State', key: 'state', width: '6.5rem' },
]

const formOpen = ref(false)

const cohortsCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_cohorts',
	method: 'GET',
})

const quartersCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_quarters',
	method: 'GET',
})

const examsCall = useCall<CodingExamSummary[]>({
	url: '/api/v2/method/cs17_portal.coding_exam.get_coding_exams',
	method: 'GET',
})

const failed = useLoadFailed(examsCall)
</script>
