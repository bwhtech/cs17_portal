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
} from '@/lib/scratch'

const props = defineProps<{
	/**
	 * The project to open. May arrive after the iframe boots — it is pushed in
	 * as soon as both are ready, whichever order that happens in.
	 */
	sb3?: ArrayBuffer | null
	/** Hides the editing chrome and blocks the context menu. */
	readOnly?: boolean
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

let editorReady = false
let loaded = false

// The editor reads `tw:theme` and its addon settings out of localStorage as it
// boots, so they have to be in place before the iframe is even created.
onBeforeMount(() => applyScratchDefaults())

function post(message: Record<string, unknown>, transfer: ArrayBuffer[] = []) {
	frame.value?.contentWindow?.postMessage(message, SCRATCH_TARGET_ORIGIN, transfer)
}

/**
 * Push the project in. Sends a copy: `postMessage` transfers (and so detaches)
 * the buffer, which would leave the caller holding an empty one — and this can
 * run twice if the frame reloads.
 */
function loadProject() {
	if (loaded || !editorReady || !props.sb3) return
	const sb3 = props.sb3.slice(0)
	loaded = true
	post({ type: SCRATCH_MESSAGE.loadProject, sb3 }, [sb3])
}

function onLoad() {
	// Read-only styling is injected into the iframe document, so it has to be
	// re-applied on every load, not only when the editor announces itself.
	if (props.readOnly) applyScratchReadOnly(frame.value)
}

function onMessage(event: MessageEvent) {
	const data = event.data ?? {}
	if (data.type === SCRATCH_MESSAGE.ready) {
		editorReady = true
		loadProject()
		if (props.readOnly) applyScratchReadOnly(frame.value)
		emit('ready')
	} else if (data.type === SCRATCH_MESSAGE.dirty) {
		// A read-only frame should never report changes; if it somehow does,
		// swallowing it here keeps the parent's autosave from ever firing.
		if (!props.readOnly) emit('dirty')
	} else if (data.type === SCRATCH_MESSAGE.projectSb3) {
		emit('sb3', { sb3: data.sb3, thumbnail: data.thumbnail })
	}
}

// A project fetched after the frame booted still gets loaded.
watch(() => props.sb3, loadProject)

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

/** Ask the editor for the current project; the answer arrives as `sb3`. */
function requestSb3() {
	if (!editorReady) return
	post({ type: SCRATCH_MESSAGE.requestSb3 })
}

defineExpose({ requestSb3 })
</script>
