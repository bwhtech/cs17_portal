<template>
	<ol class="divide-y divide-outline-gray-1 rounded-4 border border-outline-gray-1">
		<li v-for="(revision, index) in revisions" :key="revision.name" class="space-y-3 p-4">
			<div class="flex flex-wrap items-baseline justify-between gap-x-3">
				<p class="text-base-medium text-ink-gray-8">
					Attempt {{ revisions.length - index }}
				</p>
				<p v-if="revision.submitted_at" class="text-sm text-ink-gray-5">
					Submitted {{ formatDateTime(revision.submitted_at) }}
				</p>
			</div>

			<div>
				<p class="text-xs text-ink-gray-5">
					Sent back {{ formatDateTime(revision.returned_on) }}
				</p>
				<p class="whitespace-pre-line text-p-base text-ink-gray-8" dir="auto">
					{{ revision.reason }}
				</p>
			</div>

			<div v-if="revision.graded_by" class="space-y-1">
				<p class="text-xs text-ink-gray-5">{{ evaluationType ? 'Grade' : 'Remarks' }}</p>
				<p v-if="evaluationType" class="text-base text-ink-gray-8">
					{{
						formatGrade({
							evaluationType,
							grade: revision.grade,
							marksObtained: revision.marks_obtained,
							maxMarks,
						})
					}}
				</p>
				<MarkdownText v-if="revision.remarks" :content="revision.remarks" />
			</div>

			<pre
				v-if="revision.code"
				class="max-h-64 overflow-auto rounded-2 bg-surface-gray-2 p-3 font-mono text-sm text-ink-gray-8"
				v-text="revision.code"
			/>
			<Button
				v-else-if="revision.submission_document || revision.submission_url"
				icon-left="lucide-external-link"
				label="Open submitted work"
				:href="revision.submission_document || revision.submission_url || undefined"
				target="_blank"
			/>
		</li>
	</ol>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import MarkdownText from '@/components/common/MarkdownText.vue'
import { formatDateTime } from '@/lib/dates'
import { formatGrade } from '@/lib/grades'
import type { EvaluationType, SubmissionRevision } from '@/types'

defineProps<{
	revisions: SubmissionRevision[]
	evaluationType?: EvaluationType | '' | null
	maxMarks?: number
}>()
</script>
