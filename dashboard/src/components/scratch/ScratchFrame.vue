<template>
	<div class="relative h-full w-full">
		<iframe
			ref="frame"
			:src="SCRATCH_EDITOR_URL"
			:title="readOnly ? 'Scratch project player' : 'Scratch editor'"
			class="h-full w-full border-0"
			:class="{ invisible: projectStatus !== 'loaded' }"
			@load="onLoad"
		/>
		<EmptyState
			v-if="projectStatus === 'failed'"
			class="absolute inset-0"
			icon="lucide-triangle-alert"
			title="Could not open this project"
		/>
		<Skeleton v-else-if="projectStatus === 'loading'" class="absolute inset-0" />
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { Skeleton } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import {
	SCRATCH_EDITOR_URL,
	SCRATCH_MESSAGE,
	SCRATCH_TARGET_ORIGIN,
	applyScratchDefaults,
	applyScratchReadOnly,
	scratchRuntime,
} from '@/lib/scratch'

const PROJECT_LOAD_TIMEOUT_MS = 15000

const props = defineProps<{
	/**
	 * The project to open. May arrive after the iframe boots — it is pushed in
	 * as soon as both are ready, whichever order that happens in.
	 */
	sb3?: ArrayBuffer | null
	/** Hides the editing chrome and blocks the context menu. */
	readOnly?: boolean
	blank?: boolean
}>()

const emit = defineEmits<{
	/** The iframe has booted and any `sb3` is already loaded into it. */
	ready: []
	/** The project changed. The parent owns the autosave debounce. */
	dirty: []
	/** The answer to `requestSb3()`. */
	sb3: [payload: { sb3: ArrayBuffer; thumbnail?: string }]
}>()

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const frameLoaded = ref(false)
const projectStatus = ref<'loading' | 'loaded' | 'failed'>('loading')

let bootedDocument: Document | null = null
let projectDocument: Document | null = null
let loaded = false
let exported: ArrayBuffer | null = null
let pendingRequests = 0
let loadTimer: ReturnType<typeof setTimeout> | undefined

// The editor reads `tw:theme` and its addon settings out of localStorage as it
// boots, so they have to be in place before the iframe is even created.
onBeforeMount(() => applyScratchDefaults())

function post(message: Record<string, unknown>, transfer: ArrayBuffer[] = []) {
	frame.value?.contentWindow?.postMessage(message, SCRATCH_TARGET_ORIGIN, transfer)
}

function isCurrent(frameDocument: Document | null) {
	return frameDocument !== null && frameDocument === frame.value?.contentDocument
}

/**
 * Push the project in. Sends a copy: `postMessage` transfers (and so detaches)
 * the buffer, which would leave the caller holding an empty one — and this can
 * run twice if the frame reloads.
 */
function loadProject() {
	const project = exported ?? props.sb3
	if (loaded || !isCurrent(bootedDocument) || !project) return
	const sb3 = project.slice(0)
	loaded = true
	loadTimer = setTimeout(() => (projectStatus.value = 'failed'), PROJECT_LOAD_TIMEOUT_MS)
	scratchRuntime(frame.value)?.once('PROJECT_LOADED', () => {
		clearTimeout(loadTimer)
		projectDocument = bootedDocument
		projectStatus.value = 'loaded'
	})
	post({ type: SCRATCH_MESSAGE.loadProject, sb3 }, [sb3])
}

function onEditorBooted() {
	bootedDocument = frame.value?.contentDocument ?? null
	loaded = false
	pendingRequests = 0
	loadProject()
	if (props.blank && !loaded) {
		projectDocument = bootedDocument
		projectStatus.value = 'loaded'
	}
	emit('ready')
}

function onLoad() {
	// Read-only styling is injected into the iframe document, so it has to be
	// re-applied on every load, not only when the editor announces itself.
	if (props.readOnly) applyScratchReadOnly(frame.value)
	frameLoaded.value = true
	frame.value?.contentDocument?.defaultView?.addEventListener('pagehide', () => {
		frameLoaded.value = false
		projectStatus.value = 'loading'
		clearTimeout(loadTimer)
	})
}

function onMessage(event: MessageEvent) {
	if (event.source !== frame.value?.contentWindow || event.origin !== window.location.origin)
		return
	const data = event.data ?? {}
	if (data.type === SCRATCH_MESSAGE.ready) {
		if (props.readOnly) applyScratchReadOnly(frame.value)
		const runtime = scratchRuntime(frame.value)
		if (runtime?.targets.length) onEditorBooted()
		else runtime?.once('PROJECT_LOADED', onEditorBooted)
	} else if (data.type === SCRATCH_MESSAGE.dirty) {
		// A read-only frame should never report changes; if it somehow does,
		// swallowing it here keeps the parent's autosave from ever firing.
		if (!props.readOnly) emit('dirty')
	} else if (data.type === SCRATCH_MESSAGE.projectSb3) {
		if (!pendingRequests) return
		pendingRequests--
		exported = data.sb3
		emit('sb3', { sb3: data.sb3, thumbnail: data.thumbnail })
	}
}

// A project fetched after the frame booted still gets loaded.
watch(() => props.sb3, loadProject)

watch(
	() => props.readOnly,
	(readOnly) => {
		if (readOnly && frameLoaded.value) applyScratchReadOnly(frame.value)
	},
)

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

/** Ask the editor for the current project; the answer arrives as `sb3`. */
function requestSb3(): boolean {
	if (!isCurrent(projectDocument)) return false
	pendingRequests++
	post({ type: SCRATCH_MESSAGE.requestSb3 })
	return true
}

defineExpose({ requestSb3 })
</script>
