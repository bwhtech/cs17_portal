<template>
	<AppHeader :title="result?.exam_name ?? 'Result'">
		<template #left-mobile>
			<PageHeaderBackButton fallback-route="/results" />
		</template>
		<template #actions>
			<Button
				v-if="result"
				:icon-left="isDesktop ? 'lucide-download' : undefined"
				:icon="isDesktop ? undefined : 'lucide-download'"
				label="Download"
				@click="downloadPdf"
			/>
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
			This result is not available. It may not be published yet.
		</p>

		<div v-else class="space-y-6">
			<h1 class="break-words text-2xl text-ink-gray-9 md:sr-only">{{ result.exam_name }}</h1>

			<ResultCard :result="result" :assignment-route="assignmentRoute" />
		</div>
	</PageBody>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Button, PageHeaderBackButton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import ResultCard from '@/components/results/ResultCard.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { isRefusal } from '@/lib/frappeError'
import type { CS17Result } from '@/types'

const props = defineProps<{ resultId: string }>()

const breadcrumbs = useBreadcrumbs()
const { isDesktop } = useBreakpoint()

const resultCall = useCall<CS17Result, { result: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_result',
	params: () => ({ result: props.resultId }),
	refetch: true,
})

const result = computed(() => resultCall.data ?? null)
const loading = computed(() => resultCall.loading && !resultCall.data)
const failed = useLoadFailed(resultCall, { except: isRefusal })

const assignmentRoute = (assignment: string) => `/assignments/${assignment}/submission`

/**
 * The report card as the desk prints it. A full page load rather than a fetch:
 * the endpoint answers with a PDF, and the browser is what should handle it.
 */
function downloadPdf() {
	const params = new URLSearchParams({
		doctype: 'CS17 Result',
		name: props.resultId,
		format: 'CS17 Result Card',
	})
	window.open(
		`/api/method/frappe.utils.print_format.download_pdf?${params}`,
		'_blank',
		'noopener',
	)
}

watch(
	() => result.value?.exam_name,
	(examName) => {
		breadcrumbs.set(
			examName ? [{ label: 'Results', route: '/results' }, { label: examName }] : [],
		)
	},
	{ immediate: true },
)
</script>
