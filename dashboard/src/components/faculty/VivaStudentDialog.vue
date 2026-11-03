<template>
	<Dialog
		:open="open"
		:title="student.student_name"
		size="3xl"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<VivaQuestionCard
				v-for="section in sections"
				:key="`${resetCount}:${picks[section]}`"
				:question="questionsByName[picks[section]]"
				:section-questions="
					viva.questions.filter((question) => question.section === section)
				"
				:marks="marks[picks[section]]"
				@update:marks="marks[picks[section]] = $event"
				@swap="swap(section, $event)"
			/>
			<ErrorMessage
				v-if="missingMessage || saveError"
				:message="missingMessage || saveError"
			/>
		</div>

		<template #actions>
			<div class="flex items-center justify-between gap-3">
				<p class="text-base text-ink-gray-7">Total {{ total }} / {{ viva.max_marks }}</p>
				<Button
					variant="solid"
					:label="hasNext ? 'Save and next' : 'Save'"
					:loading="saveCall.loading"
					@click="save"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, toast, useCall } from 'frappe-ui'
import VivaQuestionCard from '@/components/faculty/VivaQuestionCard.vue'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import { pickQuestions, vivaSections, vivaTotal, type Viva, type VivaStudent } from '@/lib/viva'

const props = defineProps<{ open: boolean; viva: Viva; student: VivaStudent; hasNext: boolean }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()

const picks = ref<Record<string, string>>({})
const marks = ref<Record<string, number>>({})
const attempted = ref(false)
const saveError = ref('')
const resetCount = ref(0)

const saveCall = useCall<number, { viva: string; student: string; marks: Record<string, number> }>({
	url: '/api/v2/method/cs17_portal.viva.save_viva_marks',
	method: 'POST',
	immediate: false,
})

const sections = computed(() => vivaSections(props.viva.questions))
const questionsByName = computed(() =>
	Object.fromEntries(props.viva.questions.map((question) => [question.name, question])),
)

const pickedMarks = computed(() =>
	Object.fromEntries(
		sections.value
			.filter((section) => marks.value[picks.value[section]] !== undefined)
			.map((section) => [picks.value[section], marks.value[picks.value[section]]]),
	),
)
const total = computed(() => vivaTotal(pickedMarks.value))

const missingMessage = computed(() => {
	const missing = sections.value.filter(
		(section) => marks.value[picks.value[section]] === undefined,
	)
	return attempted.value && missing.length ? `Give marks for ${missing.join(', ')}.` : ''
})

watch(
	() => [props.open, props.student.student],
	() => {
		const asked = Object.keys(props.student.marks)
		picks.value = asked.length
			? Object.fromEntries(asked.map((name) => [questionsByName.value[name].section, name]))
			: pickQuestions(props.viva.questions)
		marks.value = { ...props.student.marks }
		attempted.value = false
		saveError.value = ''
		resetCount.value++
	},
	{ immediate: true },
)

function swap(section: string, question: string) {
	picks.value[section] = question
}

async function save() {
	attempted.value = true
	saveError.value = ''
	if (missingMessage.value) return

	await trySubmit(saveCall, {
		viva: props.viva.name,
		student: props.student.student,
		marks: pickedMarks.value,
	})

	if (saveCall.error) {
		saveError.value = frappeErrorMessage(saveCall.error, 'Could not save the marks.')
		return
	}
	toast.success(`Saved ${props.student.student_name}: ${total.value} / ${props.viva.max_marks}`)
	emit('saved')
}
</script>
