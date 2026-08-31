<template>
	<!--
		The page owns the whole height it is given. Zen mode (on from mount) hands
		it the viewport; toggling zen off puts it back in the shell's scroll area,
		where `min-h` keeps the stage usable instead of collapsing to nothing.
	-->
	<div class="flex h-full min-h-[32rem] flex-col overflow-hidden bg-surface-base">
		<!--
			The editor carries its own toolbar in both modes: under zen there is no
			shell header to teleport into, and the actions belong beside the stage
			either way.
		-->
		<div
			class="flex min-h-12 shrink-0 items-center gap-2 border-b border-outline-gray-1 px-3 sm:px-5"
		>
			<Button
				variant="ghost"
				icon="lucide-arrow-left"
				aria-label="Back to projects"
				tooltip="Projects"
				route="/projects"
			/>
			<h1 class="min-w-0 truncate text-base text-ink-gray-8">{{ title }}</h1>
			<span v-if="statusLabel" class="hidden shrink-0 text-sm sm:inline" :class="statusClass">
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
						icon-left="lucide-save"
						label="Save"
						:loading="status === 'saving'"
						@click="requestSave('manual')"
					/>
					<Button
						variant="solid"
						theme="gray"
						icon-left="lucide-send"
						label="Submit"
						@click="submitOpen = true"
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
					<Button label="Back to projects" route="/projects" />
				</template>
			</EmptyState>

			<!--
				The frame waits for the document: it needs `sb3_file` before it can
				open anything, and mounting it later also spares the iframe a boot
				it would throw away when zen mode swaps the shell out.
			-->
			<div v-else-if="!project.doc" class="flex h-full items-center justify-center">
				<LoadingIndicator class="size-6 text-ink-gray-5" />
			</div>

			<ScratchFrame
				v-else
				ref="frame"
				:sb3="sb3"
				:read-only="readOnly"
				@dirty="onDirty"
				@sb3="onSb3"
			/>
		</div>

		<SubmitProjectDialog
			v-model:open="submitOpen"
			:project="id"
			:preset-assignment="presetAssignment"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Button, LoadingIndicator, toast, useCall, useDoc } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import ScratchFrame from '@/components/scratch/ScratchFrame.vue'
import SubmitProjectDialog from '@/components/projects/SubmitProjectDialog.vue'
import { useZenMode, useZenOnMount } from '@/composables/useZenMode'
import { frappeErrorMessage } from '@/lib/frappeError'
import { arrayBufferToBase64, dataUrlToBase64 } from '@/lib/scratch'
import type { CS17Project } from '@/types'

/** How long the editor has to go quiet before an autosave fires. */
const AUTOSAVE_IDLE_MS = 15000

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
const { isZen, toggle } = useZenMode()
useZenOnMount()

const frame = useTemplateRef<InstanceType<typeof ScratchFrame>>('frame')

const presetAssignment = computed(() => (route.query.assignment as string) || null)

const project = useDoc<CS17Project>({ doctype: 'CS17 Project', name: () => props.id })
const failed = computed(() => Boolean(project.error) && !project.doc)
const title = computed(() => project.doc?.project_title ?? 'Project')

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
		if (!response.ok) return
		sb3.value = await response.arrayBuffer()
	} catch {
		toast.error('Could not open the saved project. Saving now would overwrite it.')
	}
}

// Only the first response may open a project. Later ones carry the file this
// page just wrote, and pushing that back into the editor would throw away
// whatever the student has done since.
watch(
	() => project.doc,
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
	if (readOnly.value) return
	clearAutosave()
	pendingKind = kind
	status.value = 'saving'
	frame.value?.requestSb3()
}

async function onSb3(payload: { sb3: ArrayBuffer; thumbnail?: string }) {
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

	const saved = await saveProject.submit(params)
	// `submit()` resolves rather than throwing, and keeps the last good
	// response in `data` — so the error is what says whether this call landed.
	if (saveProject.error || !saved) {
		status.value = 'error'
		if (kind === 'manual') {
			toast.error(frappeErrorMessage(saveProject.error, 'Could not save the project.'))
		}
		return
	}

	status.value = 'saved'
	// Only a deliberate save refreshes the document, so the grid's "Saved
	// <when>" is current without every autosave costing a second request.
	if (kind === 'manual') project.reload()
}

onBeforeUnmount(clearAutosave)
</script>
