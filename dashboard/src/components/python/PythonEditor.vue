<template>
	<div
		class="h-full"
		@keydown.ctrl.enter.capture.prevent.stop="emit('run')"
		@keydown.meta.enter.capture.prevent.stop="emit('run')"
	>
		<CodeEditor v-model="code" :extensions="extensions" :editable="!readOnly">
			<CodeEditorContent class="h-full" />
		</CodeEditor>
	</div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { indentUnit } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { CodeEditor, CodeEditorContent, CodeKit, loadLanguage } from 'frappe-ui/code-editor'

const code = defineModel<string>({ required: true })

const props = defineProps<{ readOnly?: boolean; extensions?: Extension[] }>()

const emit = defineEmits<{ run: [] }>()

const kit = CodeKit.configure({
	lineNumbers: {},
	autocompletion: false,
	placeholder: 'Write your Python program here',
})

const fourSpaces = indentUnit.of('    ')

const python = shallowRef<Awaited<ReturnType<typeof loadLanguage>>>(null)
loadLanguage('python').then((extension) => {
	python.value = extension
})

const extensions = computed(() => [
	kit,
	fourSpaces,
	python.value ?? [],
	...(props.extensions ?? []),
])
</script>
