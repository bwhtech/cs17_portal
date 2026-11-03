<template>
	<Dialog :open="open" :title="name" size="6xl" @update:open="emit('update:open', $event)">
		<div class="space-y-3">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<Select
					v-model="assignment"
					class="w-full sm:w-80"
					label="Question"
					:options="questionOptions"
				/>
				<p v-if="loaded?.last_saved_at" class="text-sm text-ink-gray-5">
					Saved {{ formatDateTime(loaded.last_saved_at) }}
				</p>
			</div>
			<div class="h-[70vh] overflow-hidden rounded-4 border border-outline-gray-1">
				<div
					v-if="!code.loading && code.error"
					class="flex h-full items-center justify-center p-6 text-center"
				>
					<p v-if="isRefusal(code.error)" class="text-p-base text-ink-gray-5">
						{{ frappeErrorMessage(code.error, 'Could not open this code.') }}
					</p>
					<LoadError
						v-else
						class="!py-0"
						title="Could not open this code"
						:loading="code.loading"
						@retry="code.reload()"
					/>
				</div>
				<Skeleton v-else-if="!loaded" class="h-full w-full" />
				<GalleryPythonView v-else :key="assignment" :code="loaded.code ?? ''" />
			</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Dialog, Select, Skeleton, useCall } from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import GalleryPythonView from '@/components/gallery/GalleryPythonView.vue'
import {
	questionNumber,
	type LiveQuestion,
	type LiveStudent,
} from '@/components/exams/live/examLive'
import { formatDateTime } from '@/lib/dates'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'

const props = defineProps<{
	open: boolean
	exam: string
	student: LiveStudent
	questions: LiveQuestion[]
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const name = computed(() => props.student.full_name ?? props.student.student)

const questionOptions = computed(() =>
	props.student.questions
		.filter((question) => question.state !== 'not_started')
		.map((question) => ({
			label: `${questionNumber(props.questions, question.assignment)}: ${
				props.questions.find((row) => row.assignment === question.assignment)?.title ?? ''
			}`,
			value: question.assignment,
		})),
)

const assignment = ref(props.student.current_question ?? questionOptions.value[0]?.value ?? '')

const code = useCall<
	{ code: string | null; last_saved_at: string | null },
	{ exam: string; student: string; assignment: string }
>({
	url: '/api/v2/method/cs17_portal.exam_live.get_exam_question_code',
	method: 'GET',
	params: () => ({
		exam: props.exam,
		student: props.student.student,
		assignment: assignment.value,
	}),
	refetch: true,
})

const loaded = computed(() => (code.loading ? null : code.data))
</script>
