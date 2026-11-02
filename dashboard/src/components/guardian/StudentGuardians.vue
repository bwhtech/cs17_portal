<template>
	<section class="space-y-3">
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-ink-gray-8">Guardians</h2>
			<Button label="Add guardian" icon-left="lucide-plus" @click="addOpen = true" />
		</div>

		<ErrorMessage v-if="failed" message="Could not load guardians." />
		<DataTable
			v-else
			:columns="columns"
			:rows="guardians.data ?? []"
			:row-key="(row: StudentGuardian) => row.name"
			:loading="guardians.loading && !guardians.data"
			empty="No guardians yet."
		>
			<template #cell-email="{ row }">
				<span class="text-ink-gray-6">{{ row.email }}</span>
			</template>

			<template #cell-actions="{ row }">
				<Button
					variant="ghost"
					icon="lucide-trash-2"
					class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
					:aria-label="`Remove ${row.full_name}`"
					tooltip="Remove"
					@click="confirmRemove(row)"
				/>
			</template>
		</DataTable>

		<AddGuardianDialog
			v-model:open="addOpen"
			:student="student"
			@success="guardians.reload()"
		/>
	</section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button, ErrorMessage, dialog, toast, useCall } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import AddGuardianDialog from '@/components/guardian/AddGuardianDialog.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

interface StudentGuardian {
	name: string
	full_name: string
	email: string
}

const props = defineProps<{ student: string; studentName: string }>()

const addOpen = ref(false)

const guardians = useCall<StudentGuardian[], { student: string }>({
	url: '/api/v2/method/cs17_portal.guardian.get_student_guardians',
	params: () => ({ student: props.student }),
	refetch: true,
})
const failed = useLoadFailed(guardians)

const remove = useCall<null, { student: string; guardian: string }>({
	url: '/api/v2/method/cs17_portal.guardian.remove_guardian',
	method: 'POST',
	immediate: false,
})

const columns: Column[] = [
	{ header: 'Name', key: 'full_name', variant: 'primary' },
	{ header: 'Email', key: 'email' },
	{ header: '', key: 'actions', variant: 'actions', width: '3rem', align: 'right' },
]

function confirmRemove(guardian: StudentGuardian) {
	dialog.danger({
		title: 'Remove guardian?',
		message: `${guardian.full_name} will no longer see ${props.studentName}'s work.`,
		confirmLabel: 'Remove',
		onConfirm: async () => {
			await trySubmit(remove, { student: props.student, guardian: guardian.name })
			if (remove.error) {
				throw new Error(frappeErrorMessage(remove.error, 'Could not remove the guardian.'))
			}
			await guardians.reload()
			toast.success('Guardian removed')
		},
	})
}
</script>
