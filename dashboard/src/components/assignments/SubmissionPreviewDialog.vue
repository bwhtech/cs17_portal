<template>
	<Dialog
		:open="open"
		:title="title"
		:size="isScratch ? '6xl' : '2xl'"
		@update:open="emit('update:open', $event)"
	>
		<!-- A Scratch submission is a project, not a file: it plays in the
		     read-only editor, everything else is a document or a link. -->
		<div
			v-if="isScratch"
			class="h-[70vh] overflow-hidden rounded-4 border border-outline-gray-1"
		>
			<p v-if="projectError" class="p-6 text-p-base text-ink-gray-5">
				Could not load the submitted project.
			</p>
			<Skeleton v-else-if="!sb3" class="h-full w-full" />
			<ScratchFrame v-else :sb3="sb3" read-only />
		</div>

		<p v-else-if="!fileUrl" class="text-p-base text-ink-gray-5">No submission found.</p>

		<img
			v-else-if="kind === 'image'"
			:src="fileUrl"
			alt="Submission preview"
			class="max-h-[60vh] w-full rounded-4 border border-outline-gray-1 object-contain"
		/>

		<iframe
			v-else-if="kind === 'pdf'"
			:src="fileUrl"
			title="Submission preview"
			class="h-[60vh] w-full rounded-4 border border-outline-gray-1"
		/>

		<div v-else class="space-y-3">
			<p v-if="kind === 'url'" class="break-all text-p-base text-ink-gray-5">{{ fileUrl }}</p>
			<Button
				class="w-full"
				icon-left="lucide-external-link"
				:label="kind === 'url' ? 'Open link' : 'Open file'"
				:link="fileUrl"
			/>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, Skeleton, useCall } from 'frappe-ui'
import ScratchFrame from '@/components/scratch/ScratchFrame.vue'
import { base64ToArrayBuffer } from '@/lib/scratch'
import { previewKind } from '@/lib/submissionTypes'

const props = defineProps<{
	open: boolean
	title: string
	submissionType?: string
	/** The stored file, or the submitted link for a URL assignment. */
	fileUrl?: string | null
	/** The submission name — only a Scratch submission needs it. */
	submission?: string | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const isScratch = computed(() => props.submissionType === 'Scratch' && Boolean(props.submission))
const kind = computed(() => previewKind(props.submissionType, props.fileUrl))

const sb3 = ref<ArrayBuffer | null>(null)

const projectCall = useCall<{ filename: string; content: string }, { submission: string }>({
	url: '/api/v2/method/cs17_portal.api.get_submission_project',
	params: () => ({ submission: props.submission ?? '' }),
	immediate: false,
	onSuccess: (data) => {
		sb3.value = data.content ? base64ToArrayBuffer(data.content) : null
	},
})

const projectError = computed(() => Boolean(projectCall.error))

// The project is a base64 payload of its own, so it is fetched when the dialog
// actually opens rather than for every row of the table behind it.
watch(
	() => [props.open, props.submission] as const,
	([isOpen]) => {
		if (!isOpen || !isScratch.value) return
		sb3.value = null
		projectCall.reload()
	},
	{ immediate: true },
)
</script>
