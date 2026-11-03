<template>
	<ol class="space-y-1 p-2">
		<li v-for="(question, index) in questions" :key="question.assignment">
			<button
				type="button"
				class="flex w-full items-start gap-2 rounded-4 px-2.5 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				:class="
					question.assignment === active ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'
				"
				:aria-current="question.assignment === active ? 'step' : undefined"
				@click="active = question.assignment"
			>
				<span class="w-4 shrink-0 text-base tabular-nums text-ink-gray-5">{{
					index + 1
				}}</span>
				<span class="min-w-0 flex-1">
					<span class="block truncate text-base text-ink-gray-8" :title="question.title">
						{{ question.title }}
					</span>
					<span class="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-gray-5">
						{{ marksLabel(question.marks) }}
						<Badge
							:label="QUESTION_STATES[question.state].label"
							:theme="QUESTION_STATES[question.state].theme"
						/>
					</span>
				</span>
				<span
					v-if="question.is_locked"
					class="lucide-lock mt-0.5 size-4 shrink-0 text-ink-gray-5"
					role="img"
					aria-label="Locked"
				/>
			</button>
		</li>
	</ol>
</template>

<script setup lang="ts">
import { Badge } from 'frappe-ui'
import { QUESTION_STATES, marksLabel, type ExamQuestion } from '@/components/exams/codingExam'

defineProps<{ questions: ExamQuestion[] }>()

const active = defineModel<string | null>({ required: true })
</script>
