<template>
	<li class="space-y-3 rounded-4 border border-outline-gray-1 bg-surface-base p-4">
		<div class="flex items-center justify-between gap-2">
			<p class="min-w-0 truncate text-base font-medium text-ink-gray-8">{{ name }}</p>
			<div class="flex shrink-0 items-center gap-1">
				<Badge
					v-if="student.alerts"
					:label="student.alerts === 1 ? '1 alert' : `${student.alerts} alerts`"
					theme="red"
					variant="subtle"
				/>
				<Badge v-if="status" v-bind="status" variant="subtle" />
			</div>
		</div>

		<p v-if="details" class="text-sm text-ink-gray-5">{{ details }}</p>

		<ol class="space-y-1.5">
			<li
				v-for="(question, index) in student.questions"
				:key="question.assignment"
				class="flex items-center gap-2 text-sm"
			>
				<span class="min-w-0 flex-1 truncate text-ink-gray-7">
					{{ index + 1 }}. {{ titleOf(question.assignment) }}
				</span>
				<span
					v-if="question.total"
					class="flex shrink-0 items-center gap-1 tabular-nums text-ink-gray-7"
				>
					<span
						:class="[
							question.passed === question.total
								? 'lucide-circle-check text-ink-green-6'
								: 'lucide-circle-x text-ink-red-6',
							'size-3.5',
						]"
						aria-hidden="true"
					/>
					{{ question.passed }} of {{ question.total }}
				</span>
				<Badge
					class="shrink-0"
					:label="QUESTION_STATES[question.state].label"
					:theme="QUESTION_STATES[question.state].theme"
					variant="subtle"
				/>
			</li>
		</ol>

		<Button
			v-if="hasCode"
			icon-left="lucide-code"
			label="View code"
			@click="emit('viewCode')"
		/>
	</li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button } from 'frappe-ui'
import {
	QUESTION_STATES,
	activeSince,
	questionNumber,
	timeLeft,
	type LiveQuestion,
	type LiveStudent,
} from '@/components/exams/live/examLive'

const props = defineProps<{ student: LiveStudent; questions: LiveQuestion[]; now: string }>()

const emit = defineEmits<{ viewCode: [] }>()

const name = computed(() => props.student.full_name ?? props.student.student)

const hasCode = computed(() =>
	props.student.questions.some((question) => question.state !== 'not_started'),
)

const status = computed(() => {
	if (props.student.stuck) return { label: 'Stuck', theme: 'amber' } as const
	if (props.student.is_paused) return { label: 'Paused', theme: 'amber' } as const
	if (props.student.state === 'finished') return { label: 'Finished', theme: 'green' } as const
	if (props.student.state === 'not_started')
		return { label: 'Not started', theme: 'gray' } as const
	return null
})

const details = computed(() =>
	[
		props.student.current_question &&
			`On ${questionNumber(props.questions, props.student.current_question)}`,
		props.student.last_active_at && activeSince(props.student.last_active_at, props.now),
		props.student.state === 'in_progress' &&
			props.student.ends_at &&
			timeLeft(props.student.ends_at, props.now),
	]
		.filter(Boolean)
		.join(' · '),
)

function titleOf(assignment: string): string {
	return props.questions.find((question) => question.assignment === assignment)?.title ?? ''
}
</script>
