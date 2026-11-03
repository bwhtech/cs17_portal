<template>
	<div class="space-y-2">
		<FormLabel label="Questions" required />
		<p class="text-p-sm text-ink-gray-5">
			{{
				hasAttempts
					? 'Students have started, so the questions stay as they are. You can still change the marks.'
					: 'Marks assignments in Python with test cases and no submissions yet. Students see them in this order.'
			}}
		</p>

		<ol v-if="questions.length" class="space-y-2">
			<li
				v-for="(question, index) in questions"
				:key="question.assignment"
				:ref="(el) => setRowElement(question.assignment, el)"
				class="flex items-start gap-3 rounded-4 border p-2 transition-colors"
				:class="[
					over === question.assignment
						? 'border-outline-gray-3 bg-surface-gray-2'
						: 'border-outline-gray-1',
					isDragging(question) && 'opacity-40',
				]"
				@pointerdown="startDrag($event, question)"
			>
				<span
					v-if="isDesktop && !hasAttempts"
					data-grip
					class="lucide-grip-vertical mt-[1.75rem] size-4 shrink-0 cursor-grab text-ink-gray-5"
					aria-hidden="true"
				/>
				<p class="min-w-0 flex-1 truncate pt-[1.75rem] text-base text-ink-gray-8">
					{{ index + 1 }}. {{ question.title }}
				</p>
				<FormControl
					class="w-24 shrink-0"
					type="number"
					label="Marks"
					min="0"
					step="any"
					:model-value="question.marks"
					:error="markErrors[index]"
					@update:model-value="update(index, String($event ?? ''))"
				/>
				<Dropdown
					v-if="!hasAttempts && questions.length > 1"
					:options="moveOptions(index)"
					align="end"
				>
					<Button
						class="mt-[1.375rem] shrink-0"
						variant="ghost"
						icon="lucide-ellipsis"
						:aria-label="`Move ${question.title}`"
						tooltip="Move"
					/>
				</Dropdown>
				<Button
					v-if="!hasAttempts"
					variant="ghost"
					icon="lucide-trash-2"
					class="mt-[1.375rem] shrink-0 hover:!bg-surface-red-3 hover:!text-ink-red-7"
					:aria-label="`Remove ${question.title}`"
					tooltip="Remove"
					@click="questions = questions.filter((_, position) => position !== index)"
				/>
			</li>
		</ol>

		<Combobox
			v-if="!hasAttempts"
			trigger="button"
			placeholder="Add a question"
			:model-value="null"
			:options="choiceOptions"
			:loading="choicesCall.loading && !choicesCall.data"
			:empty-text="cohort ? 'No assignments left to add' : 'Pick a cohort first'"
			:error="error"
			@update:model-value="add"
		/>

		<RowDragPreview
			v-if="dragging"
			:count="1"
			:start="start"
			:offset="offset"
			:width="previewWidth"
		>
			<p class="truncate text-base text-ink-gray-8">{{ dragging[0].title }}</p>
		</RowDragPreview>
	</div>
</template>

<script setup lang="ts">
import { computed, watch, type ComponentPublicInstance } from 'vue'
import {
	Button,
	Combobox,
	Dropdown,
	FormControl,
	FormLabel,
	useCall,
	type DropdownActionOption,
} from 'frappe-ui'
import RowDragPreview from '@/components/common/RowDragPreview.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useRowDrag } from '@/composables/useRowDrag'

export interface QuestionDraft {
	assignment: string
	title: string
	marks: string
}

interface QuestionChoice {
	name: string
	title: string
	max_marks: number | null
	test_count: number
}

const props = defineProps<{
	cohort: string
	exam?: string | null
	hasAttempts?: boolean
	markErrors: string[]
	error?: string
}>()

const questions = defineModel<QuestionDraft[]>({ required: true })

const { isDesktop } = useBreakpoint()

const choicesCall = useCall<QuestionChoice[], { cohort: string; exam?: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.get_exam_question_choices',
	method: 'GET',
	params: () => ({ cohort: props.cohort, ...(props.exam ? { exam: props.exam } : {}) }),
	immediate: false,
})

watch(
	() => props.cohort,
	(cohort) => cohort && choicesCall.reload(),
	{ immediate: true },
)

const choiceOptions = computed(() => {
	if (!props.cohort) return []
	const added = new Set(questions.value.map((question) => question.assignment))
	return (choicesCall.data ?? [])
		.filter((choice) => !added.has(choice.name))
		.map((choice) => ({
			label: choice.title,
			value: choice.name,
			description: `${choice.test_count} ${choice.test_count === 1 ? 'test' : 'tests'}`,
		}))
})

function add(name: string | number | null | undefined) {
	const choice = choicesCall.data?.find((option) => option.name === name)
	if (!choice) return
	questions.value = [
		...questions.value,
		{
			assignment: choice.name,
			title: choice.title,
			marks: choice.max_marks ? String(choice.max_marks) : '',
		},
	]
}

function update(index: number, marks: string) {
	questions.value = questions.value.map((question, position) =>
		position === index ? { ...question, marks } : question,
	)
}

function move(from: number, to: number) {
	const next = [...questions.value]
	const [moved] = next.splice(from, 1)
	next.splice(to, 0, moved)
	questions.value = next
}

function moveOptions(index: number): DropdownActionOption[] {
	return [
		...(index > 0
			? [{ label: 'Move up', icon: 'lucide-arrow-up', onClick: () => move(index, index - 1) }]
			: []),
		...(index < questions.value.length - 1
			? [
					{
						label: 'Move down',
						icon: 'lucide-arrow-down',
						onClick: () => move(index, index + 1),
					},
				]
			: []),
	]
}

const rowElements: Record<string, HTMLElement | null> = {}

function setRowElement(assignment: string, el: Element | ComponentPublicInstance | null) {
	rowElements[assignment] = el as HTMLElement | null
}

const {
	dragging,
	over,
	start,
	offset,
	width: previewWidth,
	isDragging,
	press,
} = useRowDrag<QuestionDraft>({
	groups: () => rowElements,
	groupOf: (question) => question.assignment,
	pick: (question) => [question],
	onDrop: ([question], target) =>
		move(
			questions.value.indexOf(question),
			questions.value.findIndex((row) => row.assignment === target),
		),
})

function startDrag(event: PointerEvent, question: QuestionDraft) {
	if ((event.target as HTMLElement).closest('[data-grip]')) press(event, question)
}
</script>
