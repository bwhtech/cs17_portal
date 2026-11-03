<template>
	<AppHeader :title="title || 'Viva'">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/faculty/vivas" />
		</template>
	</AppHeader>

	<PageBody>
		<LoadError
			v-if="failed"
			title="Could not load this viva"
			:loading="vivaCall.loading"
			@retry="vivaCall.reload()"
		/>

		<PageSkeleton v-else-if="loading" :blocks="3" />

		<p v-else-if="!viva" class="text-p-base text-ink-gray-5">
			This viva is not available in your cohort.
		</p>

		<Tabs v-else :model-value="tab" @update:model-value="tab = String($event)">
			<TabList variant="underline">
				<TabTrigger value="students" label="Students" />
				<TabTrigger value="questions" label="Questions" />
			</TabList>

			<TabPanel value="students" class="pt-5">
				<DataTable
					:columns="studentColumns"
					:rows="viva.students"
					:row-key="(row) => row.student"
					:on-row-click="openStudent"
					empty="No students in this cohort."
				>
					<template #cell-student="{ row }">
						<span class="truncate text-base text-ink-gray-8">{{
							row.student_name
						}}</span>
					</template>

					<template #cell-marks="{ row }">
						<span v-if="isMarked(row)" class="text-base text-ink-gray-8">
							{{ vivaTotal(row.marks) }} / {{ viva.max_marks }}
						</span>
						<span v-else class="text-base text-ink-gray-4">—</span>
					</template>

					<template #cell-status="{ row }">
						<Badge
							:label="isMarked(row) ? 'Done' : 'Not yet'"
							:theme="isMarked(row) ? 'green' : 'gray'"
							variant="subtle"
						/>
					</template>
				</DataTable>
			</TabPanel>

			<TabPanel value="questions" class="pt-5">
				<DataTable
					:columns="questionColumns"
					:rows="viva.questions"
					:row-key="(row) => row.name"
					:group-by="(row) => row.section"
					:row-height="60"
					empty="No questions in this viva."
				>
					<template #cell-question="{ row }">
						<RowTitle :title="row.question">
							<span v-if="row.code" class="font-mono">{{ firstLine(row.code) }}</span>
						</RowTitle>
					</template>

					<template #cell-answer="{ row }">
						<span class="truncate text-base text-ink-gray-7">{{ row.answer }}</span>
					</template>

					<template #cell-marks="{ row }">{{ row.marks }}</template>

					<template #cell-asked="{ row }">{{ row.asked }}</template>
				</DataTable>
			</TabPanel>
		</Tabs>

		<VivaStudentDialog
			v-if="viva && selectedStudent"
			v-model:open="dialogOpen"
			:viva="viva"
			:student="selectedStudent"
			:has-next="!!nextStudent"
			@saved="openNextStudent"
		/>
	</PageBody>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Badge,
	PageHeaderBackButton,
	TabList,
	TabPanel,
	Tabs,
	TabTrigger,
	useCall,
} from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import VivaStudentDialog from '@/components/faculty/VivaStudentDialog.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { isRefusal } from '@/lib/frappeError'
import { vivaTotal, type Viva, type VivaStudent } from '@/lib/viva'

const props = defineProps<{ vivaId: string }>()

const breadcrumbs = useBreadcrumbs()

const studentColumns: Column[] = [
	{ header: 'Student', key: 'student', variant: 'primary' },
	{ header: 'Marks', key: 'marks', width: '6rem' },
	{ header: 'Status', key: 'status', width: '6rem' },
]

const questionColumns: Column[] = [
	{ header: 'Question', key: 'question', variant: 'primary' },
	{ header: 'Answer', key: 'answer', width: '16rem' },
	{ header: 'Marks', key: 'marks', width: '4rem' },
	{ header: 'Asked', key: 'asked', width: '4rem' },
]

const vivaCall = useCall<Viva, { viva: string }>({
	url: '/api/v2/method/cs17_portal.viva.get_viva',
	method: 'GET',
	params: () => ({ viva: props.vivaId }),
	refetch: true,
})

const viva = computed(() => vivaCall.data ?? null)
const loading = computed(() => vivaCall.loading && !vivaCall.data)
const failed = useLoadFailed(vivaCall, { except: isRefusal })

const title = computed(() =>
	viva.value ? `${viva.value.exam_name} · ${viva.value.subject_name}` : '',
)

watch(
	title,
	(label) => {
		breadcrumbs.set(label ? [{ label: 'Viva', route: '/faculty/vivas' }, { label }] : [])
	},
	{ immediate: true },
)

const tab = ref('students')
const dialogOpen = ref(false)
const selected = ref<string | null>(null)

const selectedStudent = computed(
	() => viva.value?.students.find((row) => row.student === selected.value) ?? null,
)

const nextStudent = computed(() => {
	const students = viva.value?.students ?? []
	const index = students.findIndex((row) => row.student === selected.value)
	const waiting = (row: VivaStudent) => !isMarked(row)
	return students.slice(index + 1).find(waiting) ?? students.slice(0, index).find(waiting) ?? null
})

function isMarked(row: VivaStudent) {
	return Object.keys(row.marks).length > 0
}

function firstLine(code: string) {
	return code.split('\n')[0]
}

function openStudent(row: VivaStudent) {
	selected.value = row.student
	dialogOpen.value = true
}

async function openNextStudent() {
	await vivaCall.reload()
	if (nextStudent.value) selected.value = nextStudent.value.student
	else dialogOpen.value = false
}
</script>
