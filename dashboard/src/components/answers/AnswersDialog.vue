<template>
	<Dialog :open="open" :title="title" size="3xl" @update:open="emit('update:open', $event)">
		<div ref="body" class="space-y-4">
			<p v-if="answerCounts(shown)" class="text-base text-ink-gray-8">
				{{ answerCounts(shown) }}
			</p>

			<dl
				v-if="summary.length"
				class="grid gap-3 rounded-4 border border-outline-gray-1 p-4 sm:grid-cols-2"
			>
				<div v-for="line in summary" :key="line.label">
					<dt class="text-xs text-ink-gray-5">{{ line.label }}</dt>
					<dd class="text-base text-ink-gray-8">{{ line.value || '—' }}</dd>
				</div>
			</dl>

			<AnswerList
				:key="opened"
				:answers="shown"
				:editable="editable"
				@status="setStatus"
				@remark="(index, remark) => emit('remark', index, remark)"
			/>

			<p v-if="note" class="text-p-sm text-ink-gray-5">{{ note }}</p>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog } from 'frappe-ui'
import AnswerList from '@/components/answers/AnswerList.vue'
import { answerCounts } from '@/lib/answers'
import type { AnswerStatus, AnswerSummary, StudentAnswer } from '@/types'

const props = withDefaults(
	defineProps<{
		open: boolean
		title: string
		answers: StudentAnswer[]
		summary?: AnswerSummary[]
		note?: string
		editable?: boolean
	}>(),
	{ summary: () => [], note: '' },
)

const emit = defineEmits<{
	'update:open': [value: boolean]
	status: [index: number, status: AnswerStatus]
	remark: [index: number, remark: string]
}>()

const picked = ref<Record<number, AnswerStatus>>({})

// frappe-ui's TabButtons measures its selected pill when it mounts. Here that is
// while the dialog is still scaling in, so the pill lands a few pixels off and
// stays there. Mounting the list again once the dialog has settled fixes it.
const body = ref<HTMLElement | null>(null)
const opened = ref(0)

watch(body, (element) => {
	element
		?.closest('.dialog-content')
		?.addEventListener('animationend', () => opened.value++, { once: true })
})

const shown = computed(() =>
	props.answers.map((answer, index) => ({
		...answer,
		status: picked.value[index] ?? answer.status,
	})),
)

watch(
	() => props.answers,
	() => {
		picked.value = {}
	},
)

function setStatus(index: number, status: AnswerStatus) {
	picked.value = { ...picked.value, [index]: status }
	emit('status', index, status)
}
</script>
