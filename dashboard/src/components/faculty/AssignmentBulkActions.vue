<template>
	<div class="flex justify-center">
		<div
			class="fixed bottom-20 z-10 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-4 border border-outline-gray-1 bg-surface-base py-2 pl-4 pr-2 text-base shadow-2xl md:bottom-6"
			role="region"
			aria-label="Selected assignments"
		>
			<p class="whitespace-nowrap text-ink-gray-8">{{ assignments.length }} selected</p>

			<div class="h-5 border-l border-outline-gray-2" />

			<Button
				label="Hand out at random"
				:icon-left="isDesktop ? 'lucide-shuffle' : undefined"
				:icon="isDesktop ? undefined : 'lucide-shuffle'"
				:tooltip="isDesktop ? undefined : 'Hand out at random'"
				:loading="distribute.loading"
				@click="handOut"
			/>

			<Button
				label="Open to everyone"
				:icon-left="isDesktop ? 'lucide-users' : undefined"
				:icon="isDesktop ? undefined : 'lucide-users'"
				:tooltip="isDesktop ? undefined : 'Open to everyone'"
				:loading="openToCohort.loading"
				@click="confirmOpen"
			/>

			<TopicSelect
				model-value=""
				placeholder="Find or create a topic"
				@update:model-value="moveToTopic"
			>
				<template #trigger>
					<Button
						label="Move to topic"
						:icon-left="isDesktop ? 'lucide-folder-input' : undefined"
						:icon="isDesktop ? undefined : 'lucide-folder-input'"
						:tooltip="isDesktop ? undefined : 'Move to topic'"
						:loading="moveCall.loading"
					/>
				</template>
			</TopicSelect>

			<Dropdown :options="difficultyOptions" side="top" align="center" :offset="8">
				<Button
					label="Set difficulty"
					:icon-left="isDesktop ? 'lucide-signal' : undefined"
					:icon="isDesktop ? undefined : 'lucide-signal'"
					:tooltip="isDesktop ? undefined : 'Set difficulty'"
					:loading="difficultyCall.loading"
				/>
			</Dropdown>

			<Button
				label="Copy"
				:icon-left="isDesktop ? 'lucide-copy' : undefined"
				:icon="isDesktop ? undefined : 'lucide-copy'"
				:tooltip="isDesktop ? undefined : 'Copy'"
				@click="copyOpen = true"
			/>

			<Button
				variant="ghost"
				icon="lucide-x"
				aria-label="Clear selection"
				tooltip="Clear selection"
				@click="emit('clear')"
			/>
		</div>

		<DistributeNextAssignmentsDialog
			v-if="nextOpen"
			v-model:open="nextOpen"
			:assignments="assignments"
			@done="emit('done')"
		/>

		<CopyAssignmentsDialog
			v-if="copyOpen"
			v-model:open="copyOpen"
			:assignments="assignments"
			:cohorts="cohorts"
			:quarters="quarters"
			@done="emit('done')"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Dropdown, dialog, toast, useCall } from 'frappe-ui'
import CopyAssignmentsDialog from '@/components/faculty/CopyAssignmentsDialog.vue'
import DistributeNextAssignmentsDialog from '@/components/faculty/DistributeNextAssignmentsDialog.vue'
import TopicSelect from '@/components/faculty/TopicSelect.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import { DIFFICULTIES, type Difficulty } from '@/types'

const props = defineProps<{
	assignments: string[]
	hasSubmissions?: boolean
	cohorts: string[]
	quarters: string[]
}>()

const emit = defineEmits<{ done: []; clear: [] }>()

const { isDesktop } = useBreakpoint()

const nextOpen = ref(false)
const copyOpen = ref(false)

const countLabel = computed(
	() =>
		`${props.assignments.length} ${props.assignments.length === 1 ? 'assignment' : 'assignments'}`,
)

const distribute = useCall<null, { assignments: string[] }>({
	url: '/api/v2/method/cs17_portal.api.distribute_assignments',
	method: 'POST',
	immediate: false,
})

const openToCohort = useCall<null, { assignments: string[] }>({
	url: '/api/v2/method/cs17_portal.api.open_assignments_to_cohort',
	method: 'POST',
	immediate: false,
})

const moveCall = useCall<null, { assignments: string[]; topic: string }>({
	url: '/api/v2/method/cs17_portal.api.move_assignments_to_topic',
	method: 'POST',
	immediate: false,
})

async function moveToTopic(topic: string) {
	await trySubmit(moveCall, { assignments: props.assignments, topic })
	if (moveCall.error) {
		toast.error(frappeErrorMessage(moveCall.error, 'Could not move the assignments.'))
		return
	}
	toast.success(
		topic
			? `Moved ${countLabel.value} to ${topic}.`
			: `Removed the topic from ${countLabel.value}.`,
	)
	emit('done')
}

const difficultyCall = useCall<null, { assignments: string[]; difficulty: Difficulty | '' }>({
	url: '/api/v2/method/cs17_portal.api.set_assignments_difficulty',
	method: 'POST',
	immediate: false,
})

const difficultyOptions = [
	...DIFFICULTIES.map((difficulty) => ({
		label: difficulty,
		onClick: () => setDifficulty(difficulty),
	})),
	{ label: 'Remove difficulty', onClick: () => setDifficulty('') },
]

async function setDifficulty(difficulty: Difficulty | '') {
	await trySubmit(difficultyCall, { assignments: props.assignments, difficulty })
	if (difficultyCall.error) {
		toast.error(frappeErrorMessage(difficultyCall.error, 'Could not set the difficulty.'))
		return
	}
	toast.success(
		difficulty
			? `Marked ${countLabel.value} as ${difficulty}.`
			: `Removed the difficulty from ${countLabel.value}.`,
	)
	emit('done')
}

function handOut() {
	if (props.hasSubmissions) nextOpen.value = true
	else confirmDistribute()
}

function confirmDistribute() {
	const label = countLabel.value
	dialog.confirm({
		title: `Hand out ${label} at random?`,
		message:
			'Each student of the cohort gets one of them. You can open them to everyone later.',
		onConfirm: async () => {
			await trySubmit(distribute, { assignments: props.assignments })
			if (distribute.error) {
				toast.error(
					frappeErrorMessage(distribute.error, 'Could not hand out the assignments.'),
				)
				return
			}
			toast.success(`Handed out ${label} at random.`)
			emit('done')
		},
	})
}

function confirmOpen() {
	const label = countLabel.value
	dialog.confirm({
		title: `Open ${label} to everyone?`,
		message:
			'Every student of the cohort will see them. What a student already submitted stays submitted.',
		onConfirm: async () => {
			await trySubmit(openToCohort, { assignments: props.assignments })
			if (openToCohort.error) {
				toast.error(
					frappeErrorMessage(openToCohort.error, 'Could not open the assignments.'),
				)
				return
			}
			toast.success(`Opened ${label} to everyone.`)
			emit('done')
		},
	})
}
</script>
