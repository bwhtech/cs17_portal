<template>
	<ul class="divide-y divide-outline-gray-1">
		<li
			v-for="(answer, index) in answers"
			:key="answer.number"
			class="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4"
		>
			<span class="w-6 shrink-0 text-sm text-ink-gray-5 sm:pt-0.5">{{ answer.number }}</span>
			<div class="min-w-0 flex-1 space-y-1">
				<p class="text-base text-ink-gray-8">{{ answer.task }}</p>
				<p class="text-p-sm text-ink-gray-6">
					<span class="text-ink-gray-5">Expected: </span>{{ answer.expected }}
				</p>
				<p v-if="answer.remark" class="text-p-sm text-ink-gray-8">
					<span class="text-ink-gray-5">Result: </span>{{ answer.remark }}
				</p>
			</div>
			<TabButtons
				v-if="editable"
				class="shrink-0 self-start"
				:model-value="answer.status"
				:options="ANSWER_STATUSES"
				@update:model-value="emit('status', index, $event as AnswerStatus)"
			/>
			<Badge
				v-else
				class="shrink-0 self-start"
				v-bind="answerBadge(answer.status)"
				variant="subtle"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { Badge, TabButtons } from 'frappe-ui'
import { ANSWER_STATUSES, answerBadge } from '@/lib/answers'
import type { AnswerStatus, StudentAnswer } from '@/types'

defineProps<{ answers: StudentAnswer[]; editable?: boolean }>()

const emit = defineEmits<{ status: [index: number, status: AnswerStatus] }>()
</script>
