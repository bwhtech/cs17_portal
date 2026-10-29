<template>
	<PanelLayout title="Add students">
		<div class="space-y-6 pt-6">
			<p class="text-p-sm text-ink-gray-5">
				Add many students at once from a CSV file. Each new student gets an email with a
				link to set their password.
			</p>

			<div class="space-y-2">
				<FileUploader
					private
					file-types=".csv"
					@success="onUploaded"
					@failure="onUploadFailed"
				>
					<template #default="{ uploading, openFileSelector }">
						<Button
							:loading="uploading || readFile.loading"
							label="Upload CSV"
							icon-left="lucide-upload"
							@click="openFileSelector"
						/>
					</template>
				</FileUploader>
				<p
					v-if="fileError"
					data-slot="error"
					role="alert"
					class="break-words text-p-sm text-ink-red-5"
				>
					{{ fileError }}
				</p>
				<p v-else class="text-p-xs text-ink-gray-5">
					The first row is First name, Last name, Email, Cohort.
				</p>
			</div>

			<template v-if="students">
				<DataTable
					:columns="columns"
					:rows="students"
					:row-key="(student) => String(student.row)"
					:row-height="60"
					empty="No students in this file."
				>
					<template #cell-name="{ row }">
						<RowTitle :title="`${row.first_name} ${row.last_name}`">
							<span :title="row.email">{{ row.email }}</span>
						</RowTitle>
					</template>
					<template #cell-cohort="{ row }">
						<span class="block truncate" :title="row.cohort">{{ row.cohort }}</span>
					</template>
					<template #cell-status="{ row }">
						<span class="flex min-w-0 items-start gap-1.5">
							<span
								class="size-4 shrink-0"
								:class="
									row.error
										? 'lucide-circle-alert text-ink-red-7'
										: 'lucide-circle-check text-ink-green-7'
								"
								aria-hidden="true"
							/>
							<span class="break-words text-ink-gray-8">{{ status(row) }}</span>
						</span>
					</template>
				</DataTable>

				<div v-if="!added && readyCount" class="space-y-2">
					<Button
						variant="solid"
						:label="`Add ${readyCount} ${readyCount === 1 ? 'student' : 'students'}`"
						:loading="add.loading"
						@click="addStudents"
					/>
					<ErrorMessage :message="addError" />
				</div>
			</template>
		</div>
	</PanelLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, ErrorMessage, FileUploader, toast, useCall, type UploadedFile } from 'frappe-ui'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import RowTitle from '@/components/common/RowTitle.vue'
import PanelLayout from '@/components/settings/PanelLayout.vue'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { NewStudent } from '@/types'

const METHOD = '/api/v2/method/cs17_portal.api'

const columns: Column[] = [
	{ header: 'Row', key: 'row', width: '3rem' },
	{ header: 'Student', key: 'name', variant: 'primary' },
	{ header: 'Cohort', key: 'cohort', width: '6rem' },
	{ header: 'Status', key: 'status' },
]

const students = ref<NewStudent[] | null>(null)
const added = ref(false)
const fileError = ref('')
const addError = ref('')

const readFile = useCall<NewStudent[], { file_url: string }>({
	url: `${METHOD}.read_students_file`,
	method: 'POST',
	immediate: false,
})

const add = useCall<NewStudent[], { students: NewStudent[] }>({
	url: `${METHOD}.add_students`,
	method: 'POST',
	immediate: false,
})

const readyCount = computed(() => students.value?.filter((student) => !student.error).length ?? 0)

function status(student: NewStudent): string {
	return student.error ?? (added.value ? 'Added' : 'Ready')
}

async function onUploaded(file: UploadedFile) {
	await trySubmit(readFile, { file_url: file.file_url })
	fileError.value = readFile.error
		? frappeErrorMessage(readFile.error, 'Could not read that file.')
		: ''
	students.value = readFile.error ? null : readFile.data
	added.value = false
	addError.value = ''
}

function onUploadFailed(uploadError: unknown) {
	fileError.value = frappeErrorMessage(uploadError, 'Could not upload that file.')
}

async function addStudents() {
	await trySubmit(add, { students: students.value ?? [] })
	if (add.error || !add.data) {
		addError.value = frappeErrorMessage(add.error, 'Could not add the students.')
		return
	}
	students.value = add.data
	added.value = true
	const skipped = add.data.length - readyCount.value
	toast.success(
		`Added ${readyCount.value} ${readyCount.value === 1 ? 'student' : 'students'}.${skipped ? ` ${skipped} skipped.` : ''}`,
	)
}
</script>
