<template>
	<!-- Zen skips the shell, so the shell header only exists on the way back. -->
	<AppHeader v-if="!isZen" />

	<PageSkeleton v-if="loading" class="px-3 py-5 sm:px-5" />

	<div v-else-if="!submission" class="px-3 py-5 pb-10 sm:px-5">
		<Button
			variant="ghost"
			icon-left="lucide-arrow-left"
			label="Submissions"
			route="/faculty/submissions"
		/>
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
				aria-label="Back to submissions"
				route="/faculty/submissions"
			/>

			<div class="min-w-0">
				<h1 class="truncate text-base font-medium text-ink-gray-8">
					{{ submission.assignment_title }}
				</h1>
				<p class="truncate text-p-sm text-ink-gray-5">
					{{ submission.full_name }} · out of {{ submission.max_marks }} marks
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
					:marks-obtained="submission.marks_obtained"
					:grade="submission.grade"
					:max-marks="submission.max_marks"
				/>
			</div>
		</header>

		<div :class="['min-h-0 bg-surface-gray-2', isZen ? 'flex-1' : 'h-[60vh] min-h-80']">
			<SubmissionPlayer
				:key="submission.name"
				:submission="submission.name"
				:submission-type="submission.submission_type"
				:file-url="fileUrl"
				:student-name="submission.full_name"
			/>
		</div>

		<div class="shrink-0 border-t border-outline-gray-1 bg-surface-base px-3 py-4 sm:px-5">
			<GradeForm
				:key="submission.name"
				:submission="submission.name"
				:max-marks="submission.max_marks"
				:evaluation-type="evaluationType"
				@saved="submissions.reload()"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Button, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import GradeBadge from '@/components/common/GradeBadge.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import GradeForm from '@/components/grading/GradeForm.vue'
import SubmissionPlayer from '@/components/grading/SubmissionPlayer.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useZenMode, useZenOnMount } from '@/composables/useZenMode'
import type { CS17Assignment, CS17Submission, CohortSubmission } from '@/types'

const props = defineProps<{ submissionId: string }>()

useZenOnMount()
const { isZen, toggle } = useZenMode()
const { set: setBreadcrumbs } = useBreadcrumbs()

const zenLabel = computed(() => (isZen.value ? 'Exit zen mode' : 'Zen mode'))

// Same call and cache key as the list page, so arriving from it renders the
// header instantly and the fresh copy lands underneath.
const submissions = useCall<CohortSubmission[]>({
	url: '/api/v2/method/cs17_portal.api.list_cohort_submissions',
	method: 'GET',
	cacheKey: 'cohort-submissions',
})

const submission = computed(
	() => submissions.data?.find((row) => row.name === props.submissionId) ?? null,
)

const loading = computed(() => !submissions.isFinished && !submissions.data)

/**
 * `list_cohort_submissions` carries no file field, so the submitted document
 * comes from the assignment's own submission list — the one existing endpoint
 * that returns it to a faculty member.
 */
const detail = useCall<
	{ assignment: CS17Assignment; submissions: CS17Submission[] },
	{ assignment: string }
>({
	url: '/api/v2/method/cs17_portal.api.get_assignment_submissions',
	method: 'GET',
	params: () => ({ assignment: submission.value?.assignment ?? '' }),
	immediate: false,
})

watch(
	() => submission.value?.assignment,
	(assignment) => {
		if (assignment) detail.reload()
	},
	{ immediate: true },
)

const detailRow = computed(
	() => detail.data?.submissions?.find((row) => row.name === props.submissionId) ?? null,
)

const fileUrl = computed(
	() => detailRow.value?.submission_document || detailRow.value?.submission_url || null,
)

/** The doctype keeps the evaluation type in a field called `remarks`. */
const evaluationType = computed(() => detail.data?.assignment?.remarks ?? null)

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
