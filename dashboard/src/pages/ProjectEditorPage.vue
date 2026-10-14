<template>
	<!--
		In zen mode, and at `md` and up, the page fills a box that does not scroll.
		Below `md` with zen off it sits in the mobile shell's scroll area, where
		`min-h` keeps the stage usable.
	-->
	<div
		class="flex h-full flex-col overflow-hidden bg-surface-base md:absolute md:inset-0"
		:class="{ 'max-md:min-h-[32rem]': !isZen }"
	>
		<div
			class="flex min-h-12 shrink-0 items-center gap-2 border-b border-outline-gray-1 px-3 sm:px-5"
		>
			<Button
				variant="ghost"
				icon="lucide-arrow-left"
				aria-label="Back to projects"
				tooltip="Projects"
				:route="projectsPath"
			/>
			<h1 class="min-w-0 truncate text-base text-ink-gray-8" :title="title">{{ title }}</h1>
			<span
				v-if="statusLabel"
				class="shrink-0 text-sm"
				:class="[statusClass, status === 'error' && !readOnly ? '' : 'hidden sm:inline']"
			>
				{{ statusLabel }}
			</span>

			<div class="ml-auto flex shrink-0 items-center gap-2">
				<Button
					:icon="isZen ? 'lucide-minimize-2' : 'lucide-maximize-2'"
					:aria-label="isZen ? 'Exit zen mode' : 'Enter zen mode'"
					:tooltip="isZen ? 'Exit zen mode' : 'Zen mode'"
					@click="toggle"
				/>
				<template v-if="!readOnly">
					<Button
						:icon-left="isDesktop ? 'lucide-save' : undefined"
						:icon="isDesktop ? undefined : 'lucide-save'"
						label="Save"
						:loading="status === 'saving'"
						@click="requestSave('manual')"
					/>
					<Button
						v-if="isStudent && !failed"
						variant="solid"
						theme="gray"
						:icon-left="isDesktop ? 'lucide-send' : undefined"
						:icon="isDesktop ? undefined : 'lucide-send'"
						label="Submit"
						:loading="status === 'saving'"
						@click="openSubmit"
					/>
				</template>
			</div>
		</div>

		<div class="min-h-0 flex-1">
			<EmptyState
				v-if="failed"
				icon="lucide-triangle-alert"
				title="Could not open this project"
				description="It may have been removed, or it belongs to someone else."
			>
				<template #action>
					<Button label="Back to projects" :route="projectsPath" />
				</template>
			</EmptyState>

			<div v-else-if="!project.data" class="flex h-full items-center justify-center">
				<LoadingIndicator class="size-6 text-ink-gray-5" />
			</div>

			<ScratchFrame
				v-else
				ref="frame"
				:sb3="sb3"
				:blank="!project.data.sb3_file"
				:read-only="readOnly"
				@dirty="onDirty"
				@sb3="onSb3"
			/>
		</div>

		<SubmitProjectDialog
			v-if="isStudent"
			v-model:open="submitOpen"
			:project="id"
			project-type="Scratch"
			:preset-assignment="presetAssignment ?? project.data?.assignment ?? null"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { Button, LoadingIndicator, toast, useCall } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import ScratchFrame from '@/components/scratch/ScratchFrame.vue'
import SubmitProjectDialog from '@/components/projects/SubmitProjectDialog.vue'
import { onBeforeShellSwap } from '@/components/shell/shellSwap'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useZenMode, useZenOnMount } from '@/composables/useZenMode'
import { useProjectsPath } from '@/composables/useProjectsPath'
import { onBeforeLogout, useSession } from '@/composables/useSession'
import { frappeErrorMessage } from '@/lib/frappeError'
import { arrayBufferToBase64, dataUrlToBase64 } from '@/lib/scratch'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Project } from '@/types'

/** How long the editor has to go quiet before an autosave fires. */
const AUTOSAVE_IDLE_MS = 15000
const EDITOR_ANSWER_TIMEOUT_MS = 15000

type SaveKind = 'manual' | 'auto'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SaveProjectParams {
	project: string
	filename: string
	content: string
	thumbnail_filename?: string
	thumbnail_content?: string
	[key: string]: string | undefined
}

const props = defineProps<{ id: string }>()

const route = useRoute()
const projectsPath = useProjectsPath()
const { isStudent } = useSession()
const { isDesktop } = useBreakpoint()
const { isZen, toggle } = useZenMode()
useZenOnMount()

const frame = useTemplateRef<InstanceType<typeof ScratchFrame>>('frame')

const presetAssignment = computed(() => (route.query.assignment as string) || null)

const project = useCall<CS17Project, { project: string }>({
	url: '/api/v2/method/cs17_portal.api.get_project',
	params: () => ({ project: props.id }),
	refetch: true,
})
const openFailed = ref(false)
const failed = computed(() => (Boolean(project.error) && !project.data) || openFailed.value)
const title = computed(() => project.data?.project_title ?? 'Project')

// Whether the assignment this project was opened for still accepts revisions.
// Only asked when there is an assignment to ask about.
const assignmentClosed = useCall<boolean, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.is_assignment_closed',
	params: () => ({ assignment: presetAssignment.value ?? '' }),
	immediate: Boolean(presetAssignment.value),
})

const readOnly = computed(() => route.query.readonly === '1' || assignmentClosed.data === true)

const saveProject = useCall<{ sb3_file: string }, SaveProjectParams>({
	url: '/api/v2/method/cs17_portal.api.save_project',
	method: 'POST',
	immediate: false,
})

const sb3 = ref<ArrayBuffer | null>(null)
const status = ref<SaveStatus>('idle')
const submitOpen = ref(false)

let pendingKind: SaveKind | null = null
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let answerTimer: ReturnType<typeof setTimeout> | undefined
let opened = false

const statusLabel = computed(() => {
	if (readOnly.value) return 'View only'
	return { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[status.value]
})
const statusClass = computed(() =>
	status.value === 'error' && !readOnly.value ? 'text-ink-red-6' : 'text-ink-gray-5',
)

/**
 * The saved project is a private File, not a method response: no `useCall`
 * shape answers with binary, so the attachment is read straight off its URL.
 */
async function openSavedProject(url: string) {
	try {
		const response = await fetch(url, { credentials: 'include' })
		if (!response.ok) throw new Error(response.statusText)
		sb3.value = await response.arrayBuffer()
	} catch {
		openFailed.value = true
	}
}

// Only the first response may open a project. Later ones carry the file this
// page just wrote, and pushing that back into the editor would throw away
// whatever the student has done since.
watch(
	() => project.data,
	(doc) => {
		if (!doc || opened) return
		opened = true
		if (doc.sb3_file) openSavedProject(doc.sb3_file)
	},
	{ immediate: true },
)

function clearAutosave() {
	if (!autosaveTimer) return
	clearTimeout(autosaveTimer)
	autosaveTimer = null
}

function onDirty() {
	if (readOnly.value) return
	clearAutosave()
	autosaveTimer = setTimeout(() => requestSave('auto'), AUTOSAVE_IDLE_MS)
}

// A closed assignment can be discovered while a timer is already pending —
// read-only has to stop the autosave, not just hide the buttons.
watch(readOnly, (value) => {
	if (value) clearAutosave()
})

/** Ask the editor to serialize; the answer comes back on `@sb3`. */
function requestSave(kind: SaveKind) {
	if (readOnly.value) return false
	clearAutosave()
	if (!frame.value?.requestSb3()) {
		if (kind === 'manual') toast.error('The project is not loaded. Nothing was saved.')
		return false
	}
	pendingKind = kind
	status.value = 'saving'
	clearTimeout(answerTimer)
	answerTimer = setTimeout(() => {
		status.value = 'error'
		toast.error('Could not save the project.')
	}, EDITOR_ANSWER_TIMEOUT_MS)
	return true
}

function saveEnded() {
	return new Promise<boolean>((resolve) => {
		watch(status, (value) => resolve(value === 'saved'), { once: true })
	})
}

/** False only when the editor holds a project and saving it failed. */
async function saveNow() {
	if (status.value === 'saving') await saveEnded()
	if (!requestSave('auto')) return true
	return saveEnded()
}

async function openSubmit() {
	if (await saveNow()) submitOpen.value = true
}

async function onSb3(payload: { sb3: ArrayBuffer; thumbnail?: string }) {
	clearTimeout(answerTimer)
	const kind = pendingKind ?? 'manual'
	pendingKind = null

	const params: SaveProjectParams = {
		project: props.id,
		filename: `${props.id}.sb3`,
		content: arrayBufferToBase64(payload.sb3),
	}
	if (payload.thumbnail) {
		params.thumbnail_filename = `${props.id}.png`
		params.thumbnail_content = dataUrlToBase64(payload.thumbnail)
	}

	const saved = await trySubmit(saveProject, params)
	if (saveProject.error || !saved) {
		status.value = 'error'
		toast.error(frappeErrorMessage(saveProject.error, 'Could not save the project.'))
		return
	}

	status.value = 'saved'
	// Only a deliberate save refreshes the document, so the grid's "Saved
	// <when>" is current without every autosave costing a second request.
	if (kind === 'manual') project.reload()
}

function hasUnsavedEdits() {
	return autosaveTimer !== null || status.value === 'saving'
}

onBeforeRouteLeave(() => !hasUnsavedEdits() || saveNow())
onBeforeLogout(() => !hasUnsavedEdits() || saveNow())
onBeforeShellSwap(() => !hasUnsavedEdits() || saveNow())

function warnBeforeUnload(event: BeforeUnloadEvent) {
	if (hasUnsavedEdits()) event.preventDefault()
}

onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => {
	clearAutosave()
	clearTimeout(answerTimer)
	window.removeEventListener('beforeunload', warnBeforeUnload)
})
</script>
