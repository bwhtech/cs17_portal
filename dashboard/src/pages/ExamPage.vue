<template>
	<ExamWorkspace
		v-if="exam?.attempt && !exam.attempt.finished_on"
		:exam="exam"
		:attempt="exam.attempt"
		@changed="examCall.reload()"
	/>

	<template v-else>
		<AppHeader :title="exam?.title ?? 'Exam'">
			<template #left-mobile>
				<PageHeaderBackButton fallback-route="/exams" />
			</template>
		</AppHeader>

		<PageBody width="narrow">
			<LoadError
				v-if="failed"
				title="Could not load this exam"
				:loading="examCall.loading"
				@retry="examCall.reload()"
			/>

			<PageSkeleton v-else-if="loading" :blocks="2" />

			<p v-else-if="!exam" class="text-p-base text-ink-gray-5">Exam not found.</p>

			<ExamOverview v-else :exam="exam" @started="examCall.reload()" />
		</PageBody>
	</template>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { PageHeaderBackButton } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageBody from '@/components/common/PageBody.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import ExamOverview from '@/components/exams/ExamOverview.vue'
import ExamWorkspace from '@/components/exams/ExamWorkspace.vue'
import { EXAM_POLL_MS, type CodingExam } from '@/components/exams/codingExam'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolledCall, usePolling } from '@/composables/usePolling'
import { isRefusal } from '@/lib/frappeError'

const props = defineProps<{ examId: string }>()

const breadcrumbs = useBreadcrumbs()

const examCall = usePolledCall<CodingExam, { exam: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.get_my_coding_exam',
	params: () => ({ exam: props.examId }),
	refetch: true,
})
usePolling(examCall.reload, EXAM_POLL_MS)

const exam = computed(() => examCall.data ?? null)
const loading = computed(() => examCall.loading && !examCall.data)
const failed = useLoadFailed(examCall, { except: isRefusal })

watch(
	() => exam.value?.title,
	(title) => {
		breadcrumbs.set(title ? [{ label: 'Exams', route: '/exams' }, { label: title }] : [])
	},
	{ immediate: true },
)
</script>
