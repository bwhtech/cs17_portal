<template>
	<div class="flex flex-col">
		<PythonEditor
			:model-value="code"
			read-only
			:extensions="extensions"
			class="min-h-0 flex-1"
		/>
		<ErrorMessage
			v-if="comments.error && !comments.data"
			class="border-t border-outline-gray-1 px-3 py-1.5"
			:message="frappeErrorMessage(comments.error, 'Could not load the comments.')"
		/>
		<p v-else class="border-t border-outline-gray-1 px-3 py-1.5 text-sm text-ink-gray-5">
			Click a line number to comment on that line.
		</p>

		<Teleport v-for="[line, container] in containers" :key="line" :to="container">
			<div
				class="mx-2 my-1.5 space-y-2 whitespace-normal rounded-4 border border-outline-gray-1 bg-surface-base p-2 font-sans"
			>
				<template v-for="comment in commentsByLine.get(line)" :key="comment.name">
					<CodeCommentForm
						v-if="editing.name === comment.name"
						v-model="editing.text"
						:label="`Comment on line ${line}`"
						:error="editing.error"
						:loading="updateCall.loading"
						@save="saveEdit(comment.name)"
						@cancel="editing.name = null"
					/>
					<div v-else class="flex items-start gap-1">
						<p
							class="flex-1 whitespace-pre-line px-1 py-1 text-p-sm text-ink-gray-8"
							dir="auto"
						>
							{{ comment.comment }}
						</p>
						<template v-if="comment.owner === user">
							<Button
								variant="ghost"
								icon="lucide-pencil"
								aria-label="Edit comment"
								tooltip="Edit"
								@click="startEdit(comment)"
							/>
							<Button
								variant="ghost"
								icon="lucide-trash-2"
								class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
								aria-label="Delete comment"
								tooltip="Delete"
								@click="confirmDelete(comment)"
							/>
						</template>
					</div>
				</template>
				<CodeCommentForm
					v-if="draft.line === line"
					v-model="draft.text"
					:label="`Comment on line ${line}`"
					:error="draft.error"
					:loading="addCall.loading"
					@save="saveDraft(line)"
					@cancel="draft.line = null"
				/>
			</div>
		</Teleport>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, shallowReactive, watch } from 'vue'
import { Decoration, EditorView, WidgetType, lineNumbers } from '@codemirror/view'
import { Button, ErrorMessage, dialog, toast, useCall } from 'frappe-ui'
import CodeCommentForm from '@/components/grading/CodeCommentForm.vue'
import PythonEditor from '@/components/python/PythonEditor.vue'
import { useSession } from '@/composables/useSession'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { CodeComment } from '@/types'

const props = defineProps<{ submission: string; code: string }>()

const { user } = useSession()

const comments = useCall<CodeComment[], { submission: string }>({
	url: '/api/v2/method/cs17_portal.code_comments.get_code_comments',
	params: () => ({ submission: props.submission }),
})

const addCall = useCall<null, { submission: string; line: number; comment: string }>({
	url: '/api/v2/method/cs17_portal.code_comments.add_code_comment',
	method: 'POST',
	immediate: false,
})

const updateCall = useCall<null, { code_comment: string; comment: string }>({
	url: '/api/v2/method/cs17_portal.code_comments.update_code_comment',
	method: 'POST',
	immediate: false,
})

const deleteCall = useCall<null, { code_comment: string }>({
	url: '/api/v2/method/cs17_portal.code_comments.delete_code_comment',
	method: 'POST',
	immediate: false,
})

const draft = reactive({ line: null as number | null, text: '', error: '' })
const editing = reactive({ name: null as string | null, text: '', error: '' })

watch(
	() => props.submission,
	() => {
		Object.assign(draft, { line: null, text: '', error: '' })
		editing.name = null
	},
)

const commentsByLine = computed(() => {
	const byLine = new Map<number, CodeComment[]>()
	for (const comment of comments.data ?? []) {
		byLine.set(comment.line, [...(byLine.get(comment.line) ?? []), comment])
	}
	return byLine
})

const containers = shallowReactive(new Map<number, HTMLElement>())

class LineComments extends WidgetType {
	line: number

	constructor(line: number) {
		super()
		this.line = line
	}

	eq(other: LineComments) {
		return other.line === this.line
	}

	toDOM() {
		const container = document.createElement('div')
		containers.set(this.line, container)
		return container
	}

	destroy(container: HTMLElement) {
		if (containers.get(this.line) === container) containers.delete(this.line)
	}
}

const clickableLineNumbers = [
	lineNumbers({
		domEventHandlers: {
			click(view, block) {
				draft.line = view.state.doc.lineAt(block.from).number
				draft.error = ''
				return true
			},
		},
	}),
	EditorView.theme({
		'.cm-lineNumbers .cm-gutterElement': { cursor: 'pointer' },
		'.cm-lineNumbers .cm-gutterElement:hover': {
			color: 'var(--ink-gray-9)',
			textDecoration: 'underline',
		},
	}),
	EditorView.lineWrapping,
]

const extensions = computed(() => {
	const lines = new Set(commentsByLine.value.keys())
	if (draft.line) lines.add(draft.line)
	return [
		...clickableLineNumbers,
		EditorView.decorations.compute(['doc'], (state) =>
			Decoration.set(
				[...lines]
					.filter((line) => line <= state.doc.lines)
					.map((line) =>
						Decoration.widget({
							widget: new LineComments(line),
							block: true,
							side: 1,
						}).range(state.doc.line(line).to),
					),
				true,
			),
		),
	]
})

async function saveDraft(line: number) {
	if (!draft.text.trim()) {
		draft.error = 'Write a comment.'
		return
	}
	await trySubmit(addCall, { submission: props.submission, line, comment: draft.text })
	if (addCall.error) {
		draft.error = frappeErrorMessage(addCall.error, 'Could not save the comment.')
		return
	}
	await comments.reload()
	Object.assign(draft, { line: null, text: '', error: '' })
}

function startEdit(comment: CodeComment) {
	Object.assign(editing, { name: comment.name, text: comment.comment, error: '' })
}

async function saveEdit(name: string) {
	if (!editing.text.trim()) {
		editing.error = 'Write a comment.'
		return
	}
	await trySubmit(updateCall, { code_comment: name, comment: editing.text })
	if (updateCall.error) {
		editing.error = frappeErrorMessage(updateCall.error, 'Could not save the comment.')
		return
	}
	await comments.reload()
	editing.name = null
}

function confirmDelete(comment: CodeComment) {
	dialog.danger({
		title: 'Delete comment?',
		message: `This removes your comment on line ${comment.line}.`,
		confirmLabel: 'Delete',
		onConfirm: async () => {
			await trySubmit(deleteCall, { code_comment: comment.name })
			if (deleteCall.error) {
				throw new Error(
					frappeErrorMessage(deleteCall.error, 'Could not delete the comment.'),
				)
			}
			await comments.reload()
			toast.success('Comment deleted')
		},
	})
}
</script>
