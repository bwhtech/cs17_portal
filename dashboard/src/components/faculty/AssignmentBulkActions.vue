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
				@click="confirmDistribute"
			/>

			<Button
				label="Open to everyone"
				:icon-left="isDesktop ? 'lucide-users' : undefined"
				:icon="isDesktop ? undefined : 'lucide-users'"
				:tooltip="isDesktop ? undefined : 'Open to everyone'"
				:loading="openToCohort.loading"
				@click="confirmOpen"
			/>

			<Button
				variant="ghost"
				icon="lucide-x"
				aria-label="Clear selection"
				tooltip="Clear selection"
				@click="emit('clear')"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, dialog, toast, useCall } from 'frappe-ui'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{ assignments: string[] }>()

const emit = defineEmits<{ done: []; clear: [] }>()

const { isDesktop } = useBreakpoint()

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
