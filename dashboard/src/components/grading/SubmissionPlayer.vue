<template>
	<div class="relative h-full w-full">
		<!-- Scratch runs in the read-only editor; every other type gets the
		     viewer its file deserves. -->
		<template v-if="isScratch">
			<div
				v-if="project.error"
				class="flex h-full items-center justify-center p-6 text-center"
			>
				<p class="text-p-base text-ink-gray-5">{{ projectError }}</p>
			</div>
			<template v-else>
				<ScratchFrame read-only :sb3="sb3" />
				<!-- Covers the booting editor until the project is actually in it. -->
				<Skeleton v-if="!sb3" class="absolute inset-0 !rounded-none" />
			</template>
		</template>

		<div
			v-else-if="fileMissing"
			class="flex h-full items-center justify-center p-6 text-center"
		>
			<p class="text-p-base text-ink-gray-5">Could not load the submitted file.</p>
		</div>

		<div v-else-if="kind === 'image'" class="flex h-full items-center justify-center p-4">
			<img
				:src="fileUrl ?? undefined"
				:alt="`Submitted image by ${studentName}`"
				class="max-h-full max-w-full rounded-3 object-contain"
				@error="fileMissing = true"
			/>
		</div>

		<iframe
			v-else-if="kind === 'pdf'"
			:src="fileUrl ?? undefined"
			title="Submitted PDF"
			class="h-full w-full border-0"
		/>

		<ArchiveViewer
			v-else-if="kind === 'archive' && fileUrl"
			:submission="submission"
			:file-url="fileUrl"
		/>

		<div
			v-else-if="fileUrl"
			class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
		>
			<p class="max-w-md text-p-sm [overflow-wrap:anywhere] text-ink-gray-5">{{ fileUrl }}</p>
			<Button icon-left="lucide-external-link" label="Open submission" :href="fileUrl" />
		</div>

		<div v-else class="flex h-full items-center justify-center p-6 text-center">
			<p class="text-p-base text-ink-gray-5">No submitted file.</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, type ShallowRef } from 'vue'
import { Button, Skeleton, useCall } from 'frappe-ui'
import ArchiveViewer from '@/components/grading/ArchiveViewer.vue'
import ScratchFrame from '@/components/scratch/ScratchFrame.vue'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'
import { base64ToArrayBuffer } from '@/lib/scratch'
import { previewKind } from '@/lib/submissionTypes'
import type { SubmissionType } from '@/types'

const props = defineProps<{
	/** `CS17 Assignment Submission` name. */
	submission: string
	submissionType?: SubmissionType | null
	/** The stored file or the pasted link, whichever the type uses. */
	fileUrl?: string | null
	/** Only for the image's alt text. */
	studentName: string
}>()

const isScratch = computed(() => props.submissionType === 'Scratch')
const kind = computed(() => previewKind(props.submissionType ?? undefined, props.fileUrl))

const fileMissing = ref(false)
watch(
	() => props.fileUrl,
	async (fileUrl) => {
		fileMissing.value = false
		if (!fileUrl || kind.value !== 'pdf') return
		const response = await fetch(fileUrl, { method: 'HEAD' }).catch(() => null)
		fileMissing.value = !response?.ok
	},
	{ immediate: true },
)

/**
 * The `.sb3` comes back base64-encoded, and only for Scratch — the endpoint
 * throws on a submission with no project file, so it is never asked otherwise.
 */
const project = useCall<{ filename: string; content: string }, { submission: string }>({
	url: '/api/v2/method/cs17_portal.api.get_submission_project',
	method: 'GET',
	params: () => ({ submission: props.submission }),
	immediate: isScratch.value,
	refetch: true,
})

const projectError = computed(() => {
	const fallback = 'Could not load the submitted project.'
	return isRefusal(project.error) ? frappeErrorMessage(project.error, fallback) : fallback
})

// Decoded once into a shallow ref: `ScratchFrame` takes a copy before it
// transfers the buffer, so this one stays intact across reloads of the frame.
const sb3: ShallowRef<ArrayBuffer | null> = shallowRef(null)
watch(
	() => project.data?.content,
	(content) => {
		sb3.value = content ? base64ToArrayBuffer(content) : null
	},
	{ immediate: true },
)
</script>
