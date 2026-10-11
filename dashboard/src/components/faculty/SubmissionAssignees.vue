<template>
	<MultiSelect
		:model-value="shown"
		:options="options"
		:loading="members.loading"
		:hide-search="options.length < 8"
		placeholder="Search faculty"
		empty-text="No faculty members"
		@update:model-value="handleChange"
	>
		<template #trigger>
			<Button
				v-if="!shownMembers.length"
				label="Assign"
				icon-left="lucide-user-plus"
				:loading="saving"
			/>
			<Button v-else variant="ghost" :loading="saving" :aria-label="triggerLabel">
				<span class="flex items-center gap-2">
					<span class="flex items-center">
						<Avatar
							v-for="member in shownMembers.slice(0, 3)"
							:key="member.user"
							class="-ml-1.5 ring-2 ring-outline-base first:ml-0"
							size="md"
							:label="member.full_name"
						/>
					</span>
					<span v-if="shownMembers.length === 1" class="truncate text-ink-gray-8">
						{{ shownMembers[0].full_name }}
					</span>
					<span v-else-if="shownMembers.length > 3" class="text-ink-gray-6">
						+{{ shownMembers.length - 3 }}
					</span>
				</span>
			</Button>
		</template>

		<template #item-prefix="{ item }">
			<Avatar size="sm" :label="item.label" />
		</template>

		<template #footer />
	</MultiSelect>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Avatar, Button, MultiSelect, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { FacultyMember } from '@/types'

const props = defineProps<{
	submission: string
	assignedTo: string[]
	cohort?: string
}>()

const emit = defineEmits<{ changed: [] }>()

const members = useCall<FacultyMember[], { cohort?: string }>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_members',
	params: () => ({ cohort: props.cohort }),
	cacheKey: ['faculty-members', props.cohort ?? ''],
})

const assign = useCall<null, { submission: string; assign_to: string }>({
	url: '/api/v2/method/cs17_portal.api.assign_submission',
	method: 'POST',
	immediate: false,
})

const unassign = useCall<null, { submission: string; assign_to: string }>({
	url: '/api/v2/method/cs17_portal.api.unassign_submission',
	method: 'POST',
	immediate: false,
})

const pending = ref<string[] | null>(null)
const saving = ref(false)

const shown = computed(() => pending.value ?? props.assignedTo)

const options = computed(() =>
	(members.data ?? []).map((member) => ({ label: member.full_name, value: member.user })),
)

const shownMembers = computed<FacultyMember[]>(() =>
	shown.value.map(
		(user) =>
			(members.data ?? []).find((member) => member.user === user) ?? {
				user,
				full_name: user,
			},
	),
)

const triggerLabel = computed(
	() => `Assigned to ${shownMembers.value.map((member) => member.full_name).join(', ')}`,
)

watch(
	() => props.assignedTo,
	() => {
		pending.value = null
	},
)

async function handleChange(value: Array<string | number>) {
	const next = value.map(String)
	const before = shown.value
	const added = next.filter((user) => !before.includes(user))
	const removed = before.filter((user) => !next.includes(user))
	if (!added.length && !removed.length) return

	pending.value = next
	saving.value = true
	let error: unknown = null
	for (const user of removed) {
		await trySubmit(unassign, { submission: props.submission, assign_to: user })
		error ??= unassign.error
	}
	for (const user of added) {
		await trySubmit(assign, { submission: props.submission, assign_to: user })
		error ??= assign.error
	}
	saving.value = false

	if (error) {
		pending.value = null
		toast.error(frappeErrorMessage(error, 'Could not update who this is assigned to.'))
	}
	emit('changed')
}
</script>
