<template>
	<Dialog
		:open="open"
		:title="`${isEdit ? 'Edit Submission' : 'Submit'}: ${assignment.title}`"
		:actions="actions"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<FormControl
				v-if="isUrl"
				v-model="url"
				type="url"
				required
				:label="config.label"
				:description="config.help"
				placeholder="https://example.com/your-work"
				@update:model-value="error = null"
			/>

			<!-- A file is uploaded the moment it is picked: the private File is
			     what the submission stores, so the method call only needs its URL. -->
			<div v-else class="space-y-2">
				<FormLabel :label="config.label" required />
				<FileUploader
					private
					:file-types="config.accept"
					:validate-file="validateFile"
					@success="onUploaded"
					@failure="onUploadFailed"
				>
					<template #default="{ uploading, progress, openFileSelector }">
						<div class="flex items-center gap-3">
							<Button
								:loading="uploading"
								:label="uploading ? `Uploading ${progress}%` : chooseLabel"
								icon-left="lucide-upload"
								@click="openFileSelector"
							/>
							<span
								v-if="fileName"
								class="min-w-0 truncate text-base text-ink-gray-7"
							>
								{{ fileName }}
							</span>
						</div>
					</template>
				</FileUploader>
				<p class="text-p-xs text-ink-gray-5">{{ config.help }}</p>
			</div>

			<img
				v-if="imagePreview"
				:src="imagePreview"
				alt="Submission preview"
				class="max-h-40 rounded-4 border border-outline-gray-1 object-contain"
			/>

			<ErrorMessage :message="error ?? undefined" />
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Button,
	Dialog,
	ErrorMessage,
	FileUploader,
	FormControl,
	FormLabel,
	useCall,
	type UploadedFile,
} from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { getSubmissionConfig, isSubmissionValid, isValidUrl } from '@/lib/submissionTypes'
import type { CS17Assignment, CS17Submission } from '@/types'

const props = defineProps<{
	open: boolean
	assignment: CS17Assignment
	/** Set when the student is replacing work they already handed in. */
	existingSubmission?: CS17Submission | null
}>()

const emit = defineEmits<{
	'update:open': [value: boolean]
	/** The submission was saved; the parent reloads its lists. */
	success: []
}>()

const SUBMISSION_METHOD =
	'cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission'

const submissionType = computed(() => props.assignment.submission_type ?? 'Any')
const config = computed(() => getSubmissionConfig(submissionType.value))
const isUrl = computed(() => submissionType.value === 'URL')
const isEdit = computed(() => Boolean(props.existingSubmission))

const url = ref('')
const fileUrl = ref<string | null>(null)
const fileName = ref('')
const imagePreview = ref<string | null>(null)
const error = ref<string | null>(null)

const chooseLabel = computed(() => (fileName.value ? 'Choose another file' : 'Choose a file'))

const submitCall = useCall<{ name: string }, { assignment: string; file_url: string }>({
	url: `/api/v2/method/${SUBMISSION_METHOD}.submit_assignment`,
	method: 'POST',
	immediate: false,
})

const editCall = useCall<{ name: string }, { submission: string; file_url: string }>({
	url: `/api/v2/method/${SUBMISSION_METHOD}.edit_submission`,
	method: 'POST',
	immediate: false,
})

const ready = computed(() => (isUrl.value ? url.value.trim().length > 0 : Boolean(fileUrl.value)))

const actions = computed(() => [
	{
		label: isEdit.value ? 'Update Submission' : 'Submit Assignment',
		variant: 'solid' as const,
		theme: 'gray' as const,
		disabled: !ready.value,
		onClick: save,
	},
])

// Every open starts clean: the dialog is reused for a different assignment,
// and a stale file URL would submit last time's work.
watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) reset()
	},
)

function reset() {
	url.value = ''
	fileUrl.value = null
	fileName.value = ''
	imagePreview.value = null
	error.value = null
}

/** Blocks the upload itself, so a wrong file type never reaches the server. */
function validateFile(file: File): string | null {
	return isSubmissionValid(submissionType.value, file, '') ? null : config.value.error
}

function onUploaded(file: UploadedFile) {
	error.value = null
	fileUrl.value = file.file_url
	fileName.value = file.file_name
	// The private file is readable by its owner, so it doubles as the preview.
	imagePreview.value = submissionType.value === 'Image' ? file.file_url : null
}

function onUploadFailed(uploadError: unknown) {
	error.value = frappeErrorMessage(uploadError, 'Could not upload that file. Please try again.')
}

async function save() {
	error.value = null
	if (isUrl.value && !isValidUrl(url.value)) {
		error.value = config.value.error
		return
	}
	const value = isUrl.value ? url.value.trim() : fileUrl.value
	if (!value) {
		error.value = config.value.error
		return
	}

	const call = isEdit.value ? editCall : submitCall
	if (isEdit.value) {
		await editCall.submit({ submission: props.existingSubmission!.name, file_url: value })
	} else {
		await submitCall.submit({ assignment: props.assignment.name, file_url: value })
	}

	// The error stays under the field rather than becoming a toast: the student
	// is still in the dialog and can fix the submission in place.
	if (call.error) {
		error.value = frappeErrorMessage(call.error, 'Could not save your submission.')
		return
	}

	emit('update:open', false)
	emit('success')
}
</script>
