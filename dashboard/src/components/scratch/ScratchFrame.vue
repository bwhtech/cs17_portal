<template>
	<iframe
		ref="frame"
		:src="SCRATCH_EDITOR_URL"
		:title="readOnly ? 'Scratch project player' : 'Scratch editor'"
		class="h-full w-full border-0"
		@load="onLoad"
	/>
</template>

<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import {
	SCRATCH_EDITOR_URL,
	SCRATCH_MESSAGE,
	SCRATCH_TARGET_ORIGIN,
	applyScratchDefaults,
	applyScratchReadOnly,
	scratchRuntime,
} from '@/lib/scratch'

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

let bootedDocument: Document | null = null
let projectDocument: Document | null = null
let loaded = false
let exported: ArrayBuffer | null = null

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
	scratchRuntime(frame.value)?.once('PROJECT_LOADED', () => {
		projectDocument = bootedDocument
	})
	post({ type: SCRATCH_MESSAGE.loadProject, sb3 }, [sb3])
}

function onEditorBooted() {
	bootedDocument = frame.value?.contentDocument ?? null
	loaded = false
	loadProject()
	if (props.blank && !loaded) projectDocument = bootedDocument
	emit('ready')
}

function onLoad() {
	// Read-only styling is injected into the iframe document, so it has to be
	// re-applied on every load, not only when the editor announces itself.
	if (props.readOnly) applyScratchReadOnly(frame.value)
}

function onMessage(event: MessageEvent) {
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
		exported = data.sb3
		emit('sb3', { sb3: data.sb3, thumbnail: data.thumbnail })
	}
}

// A project fetched after the frame booted still gets loaded.
watch(() => props.sb3, loadProject)

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

/** Ask the editor for the current project; the answer arrives as `sb3`. */
function requestSb3(): boolean {
	if (!isCurrent(projectDocument)) return false
	post({ type: SCRATCH_MESSAGE.requestSb3 })
	return true
}

defineExpose({ requestSb3 })
</script>
