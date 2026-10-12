<template>
	<div class="h-full bg-surface-base">
		<div v-if="archive.error" class="flex h-full items-center justify-center p-6">
			<EmptyState
				v-if="isRefusal(archive.error)"
				icon="lucide-file-archive"
				:title="frappeErrorMessage(archive.error, 'This archive could not be read.')"
			>
				<template #action>
					<Button icon-left="lucide-download" label="Download" :href="fileUrl" />
				</template>
			</EmptyState>
			<LoadError
				v-else
				title="Could not load this archive"
				:loading="archive.loading"
				@retry="archive.reload()"
			/>
		</div>

		<div v-else-if="!archive.data" class="cs17-delay-in h-full p-4">
			<Skeleton class="h-full w-full" />
		</div>

		<div v-else class="flex h-full flex-col md:flex-row">
			<div
				class="flex max-h-56 shrink-0 flex-col border-b border-outline-gray-1 md:max-h-none md:w-80 md:border-b-0 lg:w-96 md:border-r"
			>
				<div
					class="flex items-center gap-2 border-b border-outline-gray-1 py-1.5 pl-4 pr-2"
				>
					<p class="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-7">
						{{ archive.data.filename }}
					</p>
					<Button
						variant="ghost"
						icon="lucide-download"
						aria-label="Download archive"
						tooltip="Download"
						:href="fileUrl"
					/>
				</div>

				<EmptyState
					v-if="!nodes.length"
					icon="lucide-folder-open"
					title="This archive is empty"
				/>
				<div v-else class="min-h-0 flex-1 overflow-auto p-2" @focusin="onFocus">
					<Tree
						v-model:expanded="expanded"
						:nodes="nodes"
						node-key="path"
						guides="lines"
						aria-label="Submitted files"
					>
						<template #item="{ node, expanded: isOpen }">
							<div
								:data-file="filePath(node)"
								:class="[
									'-mx-1.5 flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-5 px-1.5 py-1',
									node.path === selectedPath
										? 'bg-surface-gray-3'
										: 'hover:bg-surface-gray-2',
								]"
								@click="select(node)"
							>
								<span
									:class="[
										iconOf(node, isOpen),
										'size-4 shrink-0 text-ink-gray-5',
									]"
									aria-hidden="true"
								/>
								<span
									class="truncate text-base text-ink-gray-8"
									:title="node.label"
									v-text="node.label"
								/>
							</div>
						</template>
					</Tree>
				</div>
			</div>

			<div class="flex min-h-0 min-w-0 flex-1 flex-col">
				<template v-if="selected">
					<div
						class="flex items-center gap-3 border-b border-outline-gray-1 px-4 py-2.5 text-sm"
					>
						<p class="min-w-0 flex-1 truncate font-mono text-ink-gray-8">
							{{ selected.path }}
						</p>
						<span class="shrink-0 text-ink-gray-5">{{
							formatBytes(selected.size)
						}}</span>
					</div>

					<div class="min-h-0 flex-1 overflow-auto">
						<div
							v-if="selected.preview === 'image'"
							class="flex h-full items-center justify-center p-4"
						>
							<img
								:src="selected.content ?? undefined"
								:alt="selected.path"
								class="max-h-full max-w-full rounded-3 object-contain"
							/>
						</div>
						<p
							v-else-if="selected.preview === 'text' && selected.content"
							class="whitespace-pre-wrap break-words p-4 font-mono text-sm text-ink-gray-8"
						>
							{{ selected.content }}
						</p>
						<EmptyState
							v-else
							icon="lucide-file"
							:title="
								selected.preview === 'text'
									? 'This file is empty'
									: 'No preview for this file'
							"
						/>
					</div>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Skeleton, Tree, useCall, type TreeNode } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import {
	buildArchiveTree,
	firstFile,
	folderPaths,
	formatBytes,
	isFolder,
	type ArchiveEntry,
	type ArchiveNode,
} from '@/lib/archive'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'

const props = defineProps<{
	submission: string
	fileUrl: string
}>()

const archive = useCall<{ filename: string; entries: ArchiveEntry[] }, { submission: string }>({
	url: '/api/v2/method/cs17_portal.submission_archive.get_submission_archive',
	method: 'GET',
	params: () => ({ submission: props.submission }),
	refetch: true,
})

const nodes = computed(() => buildArchiveTree(archive.data?.entries ?? []))

const expanded = ref<string[]>([])
const selectedPath = ref<string | null>(null)

watch(
	nodes,
	(tree) => {
		expanded.value = folderPaths(tree)
		selectedPath.value = firstFile(tree)?.path ?? null
	},
	{ immediate: true },
)

const selected = computed(
	() => archive.data?.entries.find((entry) => entry.path === selectedPath.value) ?? null,
)

function filePath(node: TreeNode): string | undefined {
	return isFolder(node as ArchiveNode) ? undefined : (node as ArchiveNode).path
}

function select(node: TreeNode) {
	selectedPath.value = filePath(node) ?? selectedPath.value
}

// The tree has no select event: a row is chosen when focus lands on it, so the
// arrow keys preview files as they move.
function onFocus(event: FocusEvent) {
	const path = (event.target as HTMLElement)
		.querySelector(':scope > [data-slot="row"] [data-file]')
		?.getAttribute('data-file')
	if (path) selectedPath.value = path
}

function iconOf(node: TreeNode, isOpen: boolean): string {
	const { entry } = node as ArchiveNode
	if (isFolder(node as ArchiveNode)) return isOpen ? 'lucide-folder-open' : 'lucide-folder'
	if (entry?.preview === 'image') return 'lucide-image'
	return entry?.preview === 'text' ? 'lucide-file-text' : 'lucide-file'
}
</script>
