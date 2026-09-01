<template>
	<Select
		:model-value="modelValue"
		:options="options"
		:placeholder="placeholder ?? 'Select a faculty member'"
		:label="label"
		:error="error"
		:empty-text="members.loading ? 'Loading…' : 'No faculty members'"
		@update:model-value="emit('update:modelValue', $event === undefined ? '' : String($event))"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Select, useCall } from 'frappe-ui'
import type { FacultyMember } from '@/types'

defineProps<{
	/** The selected faculty member's `user` id. `''` when none. */
	modelValue: string
	placeholder?: string
	/** Optional labelling, so a form field never leans on the placeholder. */
	label?: string
	error?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Mounted in three places on the assignment detail page (row action, bulk bar,
// dialog); the cache key hands each new mount the last roster while it refetches.
const members = useCall<FacultyMember[]>({
	url: '/api/v2/method/cs17_portal.api.get_faculty_members',
	cacheKey: 'faculty-members',
})

const options = computed(() =>
	(members.data ?? []).map((member) => ({ label: member.full_name, value: member.user })),
)
</script>
