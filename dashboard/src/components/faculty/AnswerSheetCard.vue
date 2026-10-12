<template>
	<section
		class="flex flex-col gap-3 rounded-4 border border-outline-gray-1 bg-surface-base p-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="min-w-0 space-y-1">
			<h2 class="text-base font-medium text-ink-gray-8">Answer sheet</h2>
			<p v-if="!sheet" class="text-p-sm text-ink-gray-5">
				A CSV or XLSX file. First row: #, Task, Expected answer, Scored. A column per
				student is optional.
			</p>
			<p v-else class="text-p-sm text-ink-gray-6">
				{{ sheet.tasks.length }} {{ sheet.tasks.length === 1 ? 'task' : 'tasks'
				}}<template v-if="sheet.students.length">
					· {{ sheet.students.length }}
					{{ sheet.students.length === 1 ? 'student' : 'students' }}
				</template>
			</p>
			<p
				v-if="unmatched.length"
				class="break-words text-p-sm text-ink-amber-7"
				:title="unmatched.join(', ')"
			>
				No student found for: {{ unmatched.slice(0, 5).join(', ') }}
				<template v-if="unmatched.length > 5">+{{ unmatched.length - 5 }} more</template>
			</p>
		</div>

		<div class="flex shrink-0 flex-wrap items-center gap-3">
			<Switch
				v-if="sheet"
				label="Show to students"
				:model-value="showAnswers"
				@update:model-value="setShown"
			/>
			<FileUploader
				private
				file-types=".csv,.xlsx"
				@success="onUploaded"
				@failure="onUploadFailed"
			>
				<template #default="{ uploading, openFileSelector }">
					<Button
						:loading="uploading || upload.loading"
						:label="sheet ? 'Replace' : 'Upload answer sheet'"
						:icon-left="sheet && !isDesktop ? undefined : 'lucide-upload'"
						:icon="sheet && !isDesktop ? 'lucide-upload' : undefined"
						:tooltip="sheet && !isDesktop ? 'Replace' : undefined"
						@click="openFileSelector"
					/>
				</template>
			</FileUploader>
			<Button
				v-if="sheet"
				icon="lucide-trash-2"
				variant="ghost"
				aria-label="Remove answer sheet"
				tooltip="Remove answer sheet"
				class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
				@click="confirmRemove"
			/>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, FileUploader, Switch, dialog, toast, useCall, type UploadedFile } from 'frappe-ui'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { AnswerSheet } from '@/types'

const METHOD = '/api/v2/method/cs17_portal.answer_sheet'

const { isDesktop } = useBreakpoint()

const props = defineProps<{
	assignment: string
	sheet: AnswerSheet | null
	showAnswers: boolean
}>()

const emit = defineEmits<{ changed: [] }>()

const upload = useCall<unknown, { assignment: string; file_url: string }>({
	url: `${METHOD}.upload_answer_sheet`,
	method: 'POST',
	immediate: false,
})

const show = useCall<null, { assignment: string; show: boolean }>({
	url: `${METHOD}.show_answers`,
	method: 'POST',
	immediate: false,
})

const remove = useCall<null, { assignment: string }>({
	url: `${METHOD}.remove_answer_sheet`,
	method: 'POST',
	immediate: false,
})

const unmatched = computed(() =>
	(props.sheet?.students ?? []).filter((row) => !row.student).map((row) => row.column),
)

async function onUploaded(file: UploadedFile) {
	await trySubmit(upload, { assignment: props.assignment, file_url: file.file_url })
	if (upload.error) {
		toast.error(frappeErrorMessage(upload.error, 'Could not read that answer sheet.'))
		return
	}
	toast.success('Answer sheet uploaded.')
	emit('changed')
}

function onUploadFailed(error: unknown) {
	toast.error(frappeErrorMessage(error, 'Could not upload that file.'))
}

async function setShown(value: boolean) {
	await trySubmit(show, { assignment: props.assignment, show: value })
	if (show.error) toast.error(frappeErrorMessage(show.error, 'Could not change that.'))
	emit('changed')
}

function confirmRemove() {
	dialog.danger({
		title: 'Remove the answer sheet?',
		message: 'Students stop seeing it, and the marks set on each answer are lost.',
		onConfirm: async () => {
			await trySubmit(remove, { assignment: props.assignment })
			if (remove.error) {
				toast.error(frappeErrorMessage(remove.error, 'Could not remove the answer sheet.'))
				return
			}
			toast.success('Answer sheet removed.')
			emit('changed')
		},
	})
}
</script>
