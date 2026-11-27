<template>
	<Dialog
		:open="open"
		:title="student?.full_name ?? ''"
		v-bind="isDesktop ? { size: '4xl' } : {}"
		@update:open="emit('update:open', $event)"
	>
		<StudentDay v-if="student" :student="student.student" :date="date" />
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import StudentDay from '@/components/reports/StudentDay.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import type { StudentActivity } from '@/types'

defineProps<{
	open: boolean
	student: Pick<StudentActivity, 'student' | 'full_name'> | null
	date: string
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { isDesktop } = useBreakpoint()
</script>
