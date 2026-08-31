<template>
	<!-- The same two-column shape the student sees on AssignmentDetailPage, so
	     the author is looking at the real thing and not an approximation. -->
	<div class="flex flex-col gap-6 md:flex-row">
		<div class="min-w-0 flex-1">
			<h2 class="mb-4 text-2xl font-semibold text-ink-gray-9">
				{{ draft.title || 'Untitled Assignment' }}
			</h2>
			<MarkdownText :content="draft.description" />
		</div>

		<div class="shrink-0 md:w-56">
			<div class="space-y-3 rounded-4 border border-outline-gray-1 p-4">
				<div v-for="row in metaRows" :key="row.label">
					<p class="text-xs text-ink-gray-5">{{ row.label }}</p>
					<p class="text-base font-medium text-ink-gray-8">{{ row.value }}</p>
				</div>
				<Button class="w-full" label="Submit Assignment" variant="outline" disabled />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import MarkdownText from '@/components/common/MarkdownText.vue'
import { formatDateTime } from '@/lib/dates'
import type { AssignmentType, EvaluationType, SubmissionType } from '@/types'

/**
 * The authoring form's working copy of an assignment. Every field is a string
 * because it is bound straight to an input; the numbers and datetimes are
 * coerced on the way to the API, not on the way in.
 */
export interface AssignmentDraft {
	title: string
	cohort: string
	submission_type: SubmissionType
	assignment_type: AssignmentType
	max_marks: string
	/** The doctype's name for the evaluation scale: `Grade` or `Marks`. */
	remarks: EvaluationType | ''
	/** A Frappe datetime, "YYYY-MM-DD HH:mm:ss". */
	due_date: string
	description: string
}

const props = defineProps<{ draft: AssignmentDraft }>()

const evaluationType = computed(() =>
	props.draft.assignment_type === 'Graded' ? props.draft.remarks : 'Non-graded',
)

const metaRows = computed(() => {
	const rows = [
		{ label: 'Due', value: formatDateTime(props.draft.due_date) || '—' },
		{ label: 'Evaluation Type', value: evaluationType.value || '—' },
	]
	if (evaluationType.value === 'Marks') {
		rows.push({ label: 'Max Marks', value: props.draft.max_marks || '—' })
	}
	return rows
})
</script>
