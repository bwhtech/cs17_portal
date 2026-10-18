<template>
	<AppHeader v-if="!isZen" />

	<LoadError
		v-if="failed && !submission"
		title="Could not load this submission"
		:loading="detail.loading"
		@retry="detail.reload()"
	/>

	<PageSkeleton v-else-if="loading" class="px-3 py-5 sm:px-5" />

	<div v-else-if="!submission" class="px-3 py-5 pb-10 sm:px-5">
		<Button icon-left="lucide-arrow-left" label="Submissions" route="/faculty/submissions" />
		<p class="mt-3 text-p-base text-ink-gray-5">
			This submission is not available in your cohort.
		</p>
	</div>

	<!-- One workspace, two heights: under zen the page owns the viewport and
	     the form is pinned to its foot; inside the shell it is an ordinary
	     block that scrolls with the page. -->
	<div v-else :class="['flex flex-col', isZen ? 'h-full' : '']">
		<header
			class="flex shrink-0 items-center gap-3 border-b border-outline-gray-1 bg-surface-base px-3 py-2 sm:px-5"
		>
			<Button
				variant="ghost"
				icon="lucide-arrow-left"
				aria-label="Back"
				tooltip="Back"
				@click="goBack"
			/>

			<div class="min-w-0">
				<h1
					class="text-base font-medium text-ink-gray-8 [overflow-wrap:anywhere] max-md:line-clamp-2 md:truncate"
					dir="auto"
					:title="submission.assignment_title"
				>
					{{ submission.assignment_title }}
				</h1>
				<p class="flex flex-wrap gap-x-1 text-p-sm text-ink-gray-5 md:flex-nowrap">
					<span class="truncate" :title="submission.full_name">{{
						submission.full_name
					}}</span>
					<span v-if="submission.evaluation_type === 'Marks'" class="shrink-0">
						· out of {{ submission.max_marks }}
						{{ submission.max_marks === 1 ? 'mark' : 'marks' }}
					</span>
				</p>
			</div>

			<div class="ml-auto flex shrink-0 items-center gap-2">
				<Button
					variant="ghost"
					:icon="isZen ? 'lucide-minimize-2' : 'lucide-maximize-2'"
					:aria-label="zenLabel"
					:tooltip="zenLabel"
					@click="toggle"
				/>
				<GradeBadge
					:graded="submission.graded"
					:evaluation-type="submission.evaluation_type"
					:marks-obtained="submission.marks_obtained"
					:grade="submission.grade"
					:max-marks="submission.max_marks"
				/>
			</div>
		</header>

		<div :class="['min-h-0 bg-surface-gray-2', isZen ? 'flex-1' : 'h-[60vh] min-h-80']">
			<LoadError
				v-if="failed && !isProjectSubmission(submission.submission_type)"
				class="h-full"
				title="Could not load the submitted file"
				:loading="detail.loading"
				@retry="detail.reload()"
			/>
			<div
				v-else-if="detailLoading && !isProjectSubmission(submission.submission_type)"
				class="cs17-delay-in h-full p-4"
			>
				<Skeleton class="h-full w-full" />
			</div>
			<SubmissionPlayer
				v-else
				:key="submission.name"
				:submission="submission.name"
				:submission-type="submission.submission_type"
				:file-url="fileUrl"
				:student-name="submission.full_name"
				:assignment="submission.assignment"
				@score="testScore = $event"
			/>
		</div>

		<div
			v-if="submission.evaluation_type"
			class="shrink-0 border-t border-outline-gray-1 bg-surface-base px-3 py-4 sm:px-5"
		>
			<GradeForm
				:key="submission.name"
				:submission="submission.name"
				:max-marks="submission.max_marks"
				:evaluation-type="submission.evaluation_type"
				:suggested-marks="suggestedMarks"
				@saved="detail.reload()"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Skeleton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import GradeBadge from '@/components/common/GradeBadge.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import GradeForm from '@/components/grading/GradeForm.vue'
import SubmissionPlayer from '@/components/grading/SubmissionPlayer.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { useZenMode, useZenOnMount } from '@/composables/useZenMode'
import { isRefusal } from '@/lib/frappeError'
import { isProjectSubmission } from '@/lib/submissionTypes'
import type { CS17Submission, CohortSubmission } from '@/types'

const props = defineProps<{ submissionId: string }>()

useZenOnMount()
const { isZen, toggle } = useZenMode()
const router = useRouter()

function goBack() {
	if (window.history.state?.back) router.back()
	else router.push('/faculty/submissions')
}
const { set: setBreadcrumbs } = useBreadcrumbs()

const zenLabel = computed(() => (isZen.value ? 'Exit zen mode' : 'Zen mode'))

// The list page's cache, read and never fetched here, so arriving from it
// renders the header instantly and this submission's own row lands underneath.
const cohortSubmissions = useCall<CohortSubmission[]>({
	url: '/api/v2/method/cs17_portal.api.list_cohort_submissions',
	method: 'GET',
	cacheKey: 'cohort-submissions',
	immediate: false,
})

const detail = useCall<
	CohortSubmission & Pick<CS17Submission, 'submission_document' | 'submission_url'>,
	{ submission: string }
>({
	url: '/api/v2/method/cs17_portal.api.get_submission',
	method: 'GET',
	params: () => ({ submission: props.submissionId }),
	refetch: true,
})

const detailRow = computed(() => (detail.data?.name === props.submissionId ? detail.data : null))

const submission = computed(() =>
	isRefusal(detail.error)
		? null
		: (detailRow.value ??
			cohortSubmissions.data?.find((row) => row.name === props.submissionId) ??
			null),
)

const loading = computed(() => !detail.isFinished && !submission.value)
const failed = useLoadFailed(detail, { except: isRefusal })

const detailLoading = computed(() => !detail.isFinished && !detailRow.value)

const testScore = ref<{ passed: number; total: number } | null>(null)
watch(
	() => props.submissionId,
	() => {
		testScore.value = null
	},
)

const suggestedMarks = computed(() => {
	if (!testScore.value || submission.value?.evaluation_type !== 'Marks') return null
	const { passed, total } = testScore.value
	return Math.round((passed / total) * submission.value.max_marks * 100) / 100
})

const fileUrl = computed(
	() => detailRow.value?.submission_document || detailRow.value?.submission_url || null,
)

watch(
	() => submission.value?.assignment_title,
	(title) => {
		setBreadcrumbs([
			{ label: 'Submissions', route: '/faculty/submissions' },
			{ label: title ?? 'Grading' },
		])
	},
	{ immediate: true },
)
</script>
