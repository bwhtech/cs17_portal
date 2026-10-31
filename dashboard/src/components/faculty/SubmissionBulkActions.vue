<template>
	<div class="flex justify-center">
		<div
			class="fixed bottom-20 z-10 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-4 border border-outline-gray-1 bg-surface-base py-2 pl-4 pr-2 text-base shadow-2xl md:bottom-6"
			role="region"
			aria-label="Selected submissions"
		>
			<p class="whitespace-nowrap text-ink-gray-8">{{ submissions.length }} selected</p>

			<div class="h-5 border-l border-outline-gray-2" />

			<Dropdown :options="options" side="top" align="center" :offset="8">
				<Button
					label="Assign to"
					:icon-left="isDesktop ? 'lucide-user-plus' : undefined"
					:icon-right="isDesktop ? 'lucide-chevron-up' : undefined"
					:icon="isDesktop ? undefined : 'lucide-user-plus'"
					:tooltip="isDesktop ? undefined : 'Assign to'"
					:loading="assign.loading"
				/>
			</Dropdown>

			<CheckWithAIButton
				v-if="aiModels?.length && ungradedSubmissions?.length"
				:models="aiModels"
				label="Check with AI"
				:icon-left="isDesktop ? 'lucide-sparkles' : undefined"
				:icon-right="isDesktop && aiModels.length > 1 ? 'lucide-chevron-up' : undefined"
				:icon="isDesktop ? undefined : 'lucide-sparkles'"
				:tooltip="isDesktop ? undefined : 'Check with AI'"
				:loading="aiCheck.loading"
				@check="confirmAiCheck"
			/>

			<Button
				v-if="draftGrades"
				:label="publishLabel"
				:icon-left="isDesktop ? 'lucide-send' : undefined"
				:icon="isDesktop ? undefined : 'lucide-send'"
				:tooltip="isDesktop ? undefined : publishLabel"
				:loading="publish.loading"
				@click="confirmPublish"
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
import { computed, h } from 'vue'
import { Button, Dropdown, dialog, toast, useCall } from 'frappe-ui'
import FacultyAvatar from '@/components/faculty/FacultyAvatar.vue'
import CheckWithAIButton from '@/components/grading/CheckWithAIButton.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useFacultyMembers } from '@/composables/useFacultyMembers'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { FacultyMember } from '@/types'

const props = defineProps<{
	/** The selected submission names. */
	submissions: string[]
	cohort?: string
	/** How many of the selected submissions have a grade that is still a draft. */
	draftGrades?: number
	remarksOnly?: boolean
	aiModels?: string[]
	ungradedSubmissions?: string[]
}>()

const emit = defineEmits<{ done: []; clear: []; checking: [submissions: string[]] }>()

const { isDesktop } = useBreakpoint()

const draftNoun = computed(() => {
	const one = props.draftGrades === 1
	if (props.remarksOnly) return one ? 'remark' : 'remarks'
	return one ? 'grade' : 'grades'
})

const publishLabel = computed(() => `Publish ${props.draftGrades} ${draftNoun.value}`)

const members = useFacultyMembers(props.cohort)

const assign = useCall<null, { submissions: string[]; assign_to: string }>({
	url: '/api/v2/method/cs17_portal.api.assign_submissions',
	method: 'POST',
	immediate: false,
})

const publish = useCall<number, { submissions: string[] }>({
	url: '/api/v2/method/cs17_portal.api.publish_grades',
	method: 'POST',
	immediate: false,
})

const aiCheck = useCall<
	{ queued: number; skipped: number },
	{ submissions: string[]; model: string }
>({
	url: '/api/v2/method/cs17_portal.api.check_submissions',
	method: 'POST',
	immediate: false,
})

function confirmPublish() {
	const count = props.draftGrades
	const noun = draftNoun.value
	dialog.confirm({
		title: `Publish ${count} ${noun}?`,
		message: props.remarksOnly
			? 'The students will see their remarks right away.'
			: 'The students will see their grade and remarks right away.',
		onConfirm: async () => {
			await trySubmit(publish, { submissions: props.submissions })
			if (publish.error) {
				toast.error(frappeErrorMessage(publish.error, `Could not publish the ${noun}.`))
				return
			}
			toast.success(`Published ${count} ${noun}.`)
			emit('done')
		},
	})
}

function confirmAiCheck(model: string) {
	const submissions = props.ungradedSubmissions ?? []
	const count = submissions.length
	dialog.confirm({
		title: `Check ${count} ${count === 1 ? 'submission' : 'submissions'} with AI?`,
		message: 'Each one gets a draft grade for you to review. Nothing is published.',
		onConfirm: async () => {
			await trySubmit(aiCheck, { submissions, model })
			if (aiCheck.error || !aiCheck.data) {
				toast.error(
					frappeErrorMessage(aiCheck.error, 'Could not check the submissions with AI.'),
				)
				return
			}
			const { queued, skipped } = aiCheck.data
			const skippedLine = skipped
				? ` ${skipped} already graded ${skipped === 1 ? 'was' : 'were'} skipped.`
				: ''
			toast.success(
				`Checking ${queued} ${queued === 1 ? 'submission' : 'submissions'} with AI.${skippedLine}`,
			)
			emit('checking', submissions)
			emit('done')
		},
	})
}

const options = computed(() =>
	(members.data ?? []).map((member) => ({
		label: member.full_name,
		slots: { prefix: () => h(FacultyAvatar, { member, size: 'sm' }) },
		onClick: () => handleAssign(member),
	})),
)

async function handleAssign(member: FacultyMember) {
	const count = props.submissions.length
	await trySubmit(assign, { submissions: props.submissions, assign_to: member.user })
	if (assign.error) {
		toast.error(frappeErrorMessage(assign.error, 'Could not assign the submissions.'))
		return
	}
	toast.success(
		`Assigned ${count} ${count === 1 ? 'submission' : 'submissions'} to ${member.full_name}.`,
	)
	emit('done')
}
</script>
