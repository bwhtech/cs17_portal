<template>
	<Dialog :open="open" :title="title" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<div class="space-y-2">
				<p class="text-sm font-medium text-ink-gray-7">Currently assigned</p>
				<p v-if="!assignees.length" class="text-p-xs text-ink-gray-5">No one yet.</p>
				<div v-else class="flex flex-wrap gap-2">
					<Button
						v-for="user in assignees"
						:key="user"
						variant="subtle"
						theme="gray"
						:label="nameFor(user)"
						icon-right="lucide-x"
						:loading="unassigning === user"
						:aria-label="`Unassign ${nameFor(user)}`"
						@click="handleUnassign(user)"
					/>
				</div>
			</div>

			<FacultySelect v-model="assignTo" label="Assign to faculty" :error="fieldError" />

			<ErrorMessage v-if="actionError" :message="actionError" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Assign"
				:loading="assign.loading"
				@click="handleAssign"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, useCall } from 'frappe-ui'
import FacultySelect from '@/components/faculty/FacultySelect.vue'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { FacultyMember } from '@/types'

/** What the page hands over: the row, plus its `_assign` already parsed. */
export interface AssignTarget {
	name: string
	fullName?: string
	assignedTo: string[]
}

const props = defineProps<{
	open: boolean
	submission: AssignTarget | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const assignTo = ref('')
const fieldError = ref('')
const actionError = ref('')
/** The user id whose unassign is in flight, so only that chip spins. */
const unassigning = ref('')

const title = computed(() => `Assign: ${props.submission?.fullName ?? 'Submission'}`)

const assignees = computed(() => props.submission?.assignedTo ?? [])

const members = useCall<FacultyMember[]>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_members',
	cacheKey: 'faculty-members',
})

/** ToDo stores the user id; the roster is the only place the name lives. */
function nameFor(user: string): string {
	return (members.data ?? []).find((member) => member.user === user)?.full_name ?? user
}

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

watch(
	() => props.submission?.name,
	() => {
		assignTo.value = ''
		fieldError.value = ''
		actionError.value = ''
	},
)

watch(assignTo, () => {
	fieldError.value = ''
})

async function handleAssign() {
	if (!props.submission) return
	actionError.value = ''
	if (!assignTo.value) {
		fieldError.value = 'Select a faculty member.'
		return
	}

	await assign.submit({ submission: props.submission.name, assign_to: assignTo.value })
	if (assign.error) {
		actionError.value = frappeErrorMessage(assign.error, 'Could not assign the submission.')
		return
	}
	// The dialog stays open: assigning a second reviewer is the common next step.
	assignTo.value = ''
	emit('success')
}

async function handleUnassign(user: string) {
	if (!props.submission) return
	actionError.value = ''
	unassigning.value = user
	await unassign.submit({ submission: props.submission.name, assign_to: user })
	unassigning.value = ''
	if (unassign.error) {
		actionError.value = frappeErrorMessage(unassign.error, 'Could not remove the assignment.')
		return
	}
	emit('success')
}
</script>
