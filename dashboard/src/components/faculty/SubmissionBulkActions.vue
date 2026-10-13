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
}>()

const emit = defineEmits<{ done: []; clear: [] }>()

const { isDesktop } = useBreakpoint()

const publishLabel = computed(
	() => `Publish ${props.draftGrades} ${props.draftGrades === 1 ? 'grade' : 'grades'}`,
)

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

function confirmPublish() {
	const count = props.draftGrades
	dialog.confirm({
		title: `Publish ${count} ${count === 1 ? 'grade' : 'grades'}?`,
		message: 'The students will see their grade and remarks right away.',
		onConfirm: async () => {
			await trySubmit(publish, { submissions: props.submissions })
			if (publish.error) {
				toast.error(frappeErrorMessage(publish.error, 'Could not publish the grades.'))
				return
			}
			toast.success(`Published ${count} ${count === 1 ? 'grade' : 'grades'}.`)
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
