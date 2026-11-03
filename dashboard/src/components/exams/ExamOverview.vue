<template>
	<div class="flex flex-col gap-6 md:flex-row">
		<h1 class="order-first break-words text-2xl text-ink-gray-9 md:sr-only">
			{{ exam.title }}
		</h1>

		<div class="min-w-0 flex-1 space-y-6">
			<MarkdownText :content="exam.instructions" fallback="No instructions." />

			<section v-if="exam.questions.length" class="space-y-2">
				<h2 class="text-base-medium text-ink-gray-8">Questions</h2>
				<ul
					class="divide-y divide-outline-gray-1 rounded-4 border border-outline-gray-1 bg-surface-base"
				>
					<li
						v-for="question in exam.questions"
						:key="question.assignment"
						class="flex items-center gap-3 px-4 py-2.5"
					>
						<span class="min-w-0 flex-1 truncate text-base text-ink-gray-8">
							{{ question.title }}
						</span>
						<span class="shrink-0 text-sm text-ink-gray-5">
							{{ marksLabel(question.marks) }}
						</span>
						<Badge
							:label="QUESTION_STATES[question.state].label"
							:theme="QUESTION_STATES[question.state].theme"
						/>
					</li>
				</ul>
			</section>
		</div>

		<div
			class="order-first w-full shrink-0 space-y-3 rounded-4 border border-outline-gray-1 p-4 md:order-none md:w-64 md:self-start"
		>
			<div>
				<p class="text-xs text-ink-gray-5">Duration</p>
				<p class="text-base text-ink-gray-8">{{ formatDuration(exam.duration_minutes) }}</p>
			</div>
			<div>
				<p class="text-xs text-ink-gray-5">Opens</p>
				<p class="text-base text-ink-gray-8">{{ formatDateTime(exam.opens_on) }}</p>
			</div>
			<div>
				<p class="text-xs text-ink-gray-5">Start by</p>
				<p class="text-base text-ink-gray-8">{{ formatDateTime(exam.last_start_on) }}</p>
			</div>
			<div>
				<p class="text-xs text-ink-gray-5">Closes</p>
				<p class="text-base text-ink-gray-8">{{ formatDateTime(exam.closes_on) }}</p>
			</div>
			<div>
				<p class="text-xs text-ink-gray-5">Order</p>
				<p class="text-p-sm text-ink-gray-8">{{ orderRule }}</p>
			</div>

			<div v-if="exam.attempt?.finished_on">
				<p class="text-xs text-ink-gray-5">Finished</p>
				<p class="text-base text-ink-green-6">
					{{ formatDateTime(exam.attempt.finished_on) }}
				</p>
			</div>
			<Button
				v-else-if="startWindow === 'open'"
				class="w-full"
				label="Start exam"
				@click="confirmStart"
			/>
			<p v-else-if="startWindow === 'upcoming'" class="text-sm text-ink-gray-5">
				Not open yet
			</p>
			<p v-else class="text-sm text-ink-gray-5">The last start time has passed</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, dialog, toast, useCall } from 'frappe-ui'
import MarkdownText from '@/components/common/MarkdownText.vue'
import {
	QUESTION_STATES,
	formatDuration,
	marksLabel,
	type CodingExam,
	type ExamAttempt,
} from '@/components/exams/codingExam'
import { formatDateTime, parseDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{ exam: CodingExam }>()

const emit = defineEmits<{ started: [] }>()

const startWindow = computed(() => {
	const now = parseDatetime(props.exam.now).valueOf()
	if (now < parseDatetime(props.exam.opens_on).valueOf()) return 'upcoming'
	if (now > parseDatetime(props.exam.last_start_on).valueOf()) return 'closed'
	return 'open'
})

const orderRule = computed(() => {
	if (props.exam.question_order === 'Any order')
		return 'Any order. Move between the questions as you like.'
	return props.exam.can_go_back
		? 'One by one. You can go back to a question you passed.'
		: 'One by one. You cannot go back to a question once you move on.'
})

const startCall = useCall<ExamAttempt, { exam: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.start_coding_exam',
	method: 'POST',
	immediate: false,
})

function confirmStart() {
	dialog.confirm({
		title: 'Start the exam?',
		message: 'The clock starts now and does not stop if you leave.',
		confirmLabel: 'Start exam',
		onConfirm: start,
	})
}

async function start() {
	await trySubmit(startCall, { exam: props.exam.name })
	if (startCall.error) {
		toast.error(frappeErrorMessage(startCall.error, 'Could not start the exam.'))
		return
	}
	emit('started')
}
</script>
