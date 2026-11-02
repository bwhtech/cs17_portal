<template>
	<Dialog
		:open="open"
		:title="project.project_title"
		:message="project.student_name"
		size="6xl"
		@update:open="emit('update:open', $event)"
	>
		<div class="h-[70vh] overflow-hidden rounded-4 border border-outline-gray-1">
			<div
				v-if="!opening && (failed || sharedProject.error)"
				class="flex h-full items-center justify-center p-6 text-center"
			>
				<p v-if="isRefusal(sharedProject.error)" class="text-p-base text-ink-gray-5">
					{{ frappeErrorMessage(sharedProject.error, 'Could not open this project.') }}
				</p>
				<LoadError
					v-else
					class="!py-0"
					title="Could not open this project"
					:loading="sharedProject.loading"
					@retry="sharedProject.reload()"
				/>
			</div>
			<Skeleton v-else-if="!loaded" class="h-full w-full" />
			<ScratchFrame
				v-else-if="loaded.project_type === 'Scratch'"
				:sb3="sb3"
				:blank="!sb3"
				read-only
			/>
			<GalleryPythonView v-else :code="loaded.code ?? ''" />
		</div>

		<template #actions>
			<div class="space-y-3">
				<ErrorMessage :message="actionError" />
				<div class="flex justify-end">
					<Button
						v-if="isStudent"
						variant="solid"
						theme="gray"
						icon-left="lucide-copy"
						label="Make a copy"
						:loading="copyCall.loading"
						@click="makeCopy"
					/>
					<Button
						v-else
						icon-left="lucide-eye-off"
						label="Stop sharing"
						:loading="unshareCall.loading"
						@click="stopSharing"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dialog, ErrorMessage, Skeleton, toast, useCall } from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import GalleryPythonView from '@/components/gallery/GalleryPythonView.vue'
import ScratchFrame from '@/components/scratch/ScratchFrame.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { projectEditorPath, useProjectsPath } from '@/composables/useProjectsPath'
import { useSession } from '@/composables/useSession'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'
import { base64ToArrayBuffer } from '@/lib/scratch'
import { trySubmit } from '@/lib/trySubmit'
import type { SharedProject } from '@/components/gallery/sharedProject'
import type { ProjectType } from '@/types'

interface SharedProjectContent extends SharedProject {
	code: string | null
	content: string | null
}

const props = defineProps<{ open: boolean; project: SharedProject }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; unshared: [] }>()

const router = useRouter()
const projectsPath = useProjectsPath()
const { isStudent } = useSession()

const sb3 = ref<ArrayBuffer | null>(null)
const opening = ref(false)
const actionError = ref('')

const sharedProject = useCall<SharedProjectContent, { project: string }>({
	url: '/api/v2/method/cs17_portal.gallery.get_shared_project',
	params: () => ({ project: props.project.name }),
	immediate: false,
	onSuccess: (data) => {
		sb3.value = data.content ? base64ToArrayBuffer(data.content) : null
	},
})

const failed = useLoadFailed(sharedProject, { except: isRefusal })

const loaded = computed(() =>
	!opening.value && sharedProject.data?.name === props.project.name ? sharedProject.data : null,
)

watch(
	() => sharedProject.loading,
	(loading) => {
		if (!loading) opening.value = false
	},
)

watch(
	() => [props.open, props.project.name] as const,
	([isOpen]) => {
		if (!isOpen) return
		sb3.value = null
		actionError.value = ''
		opening.value = true
		sharedProject.reload()
	},
	{ immediate: true },
)

const copyCall = useCall<{ name: string; project_type: ProjectType }, { project: string }>({
	url: '/api/v2/method/cs17_portal.gallery.copy_shared_project',
	method: 'POST',
	immediate: false,
})

const unshareCall = useCall<null, { project: string }>({
	url: '/api/v2/method/cs17_portal.gallery.unshare_project',
	method: 'POST',
	immediate: false,
})

async function makeCopy() {
	const copy = await trySubmit(copyCall, { project: props.project.name })
	if (copyCall.error || !copy) {
		actionError.value = frappeErrorMessage(copyCall.error, 'Could not copy the project.')
		return
	}
	toast.success('Project copied')
	router.push(projectEditorPath(projectsPath, copy))
}

async function stopSharing() {
	await trySubmit(unshareCall, { project: props.project.name })
	if (unshareCall.error) {
		actionError.value = frappeErrorMessage(unshareCall.error, 'Could not stop sharing.')
		return
	}
	toast.success('Sharing stopped')
	emit('update:open', false)
	emit('unshared')
}
</script>
