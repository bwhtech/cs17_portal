<template>
	<AppHeader :title="title || 'Result'">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/faculty/results" />
		</template>
		<template #actions>
			<Badge v-if="result" v-bind="publishStatus(result)" variant="subtle" />
		</template>
	</AppHeader>

	<PageBody width="narrow">
		<LoadError
			v-if="failed"
			title="Could not load this result"
			:loading="resultCall.loading"
			@retry="resultCall.reload()"
		/>

		<PageSkeleton v-else-if="loading" :blocks="3" />

		<p v-else-if="!result" class="text-p-base text-ink-gray-5">
			This result is not available in your cohort.
		</p>

		<div v-else class="space-y-6">
			<h1 class="break-words text-2xl text-ink-gray-9 md:sr-only">{{ title }}</h1>

			<ResultCard :result="result" :assignment-route="assignmentRoute" />
		</div>
	</PageBody>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Badge, PageHeaderBackButton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import ResultCard from '@/components/results/ResultCard.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { isRefusal } from '@/lib/frappeError'
import { publishStatus } from '@/lib/results'
import type { FacultyResult } from '@/types'

const props = defineProps<{ resultId: string }>()

const breadcrumbs = useBreadcrumbs()

const resultCall = useCall<FacultyResult, { result: string }>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_result',
	params: () => ({ result: props.resultId }),
	refetch: true,
})

const result = computed(() => resultCall.data ?? null)
const loading = computed(() => resultCall.loading && !resultCall.data)
const failed = useLoadFailed(resultCall, { except: isRefusal })

const title = computed(() =>
	result.value
		? `${result.value.student_name || result.value.student} · ${result.value.exam_name}`
		: '',
)

const assignmentRoute = (assignment: string) => `/faculty/assignments/${assignment}`

watch(
	title,
	(label) => {
		breadcrumbs.set(label ? [{ label: 'Results', route: '/faculty/results' }, { label }] : [])
	},
	{ immediate: true },
)
</script>
