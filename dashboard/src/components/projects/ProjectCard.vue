<template>
	<div class="relative">
		<router-link
			:to="projectEditorPath(projectsPath, project)"
			class="block overflow-hidden rounded-4 border border-outline-gray-1 bg-surface-base transition-colors hover:border-outline-gray-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
		>
			<div
				v-if="!isPython"
				class="flex aspect-[4/3] items-center justify-center bg-surface-gray-2"
			>
				<img
					v-if="project.thumbnail && !thumbnailFailed"
					:src="project.thumbnail"
					alt=""
					loading="lazy"
					class="h-full w-full object-cover"
					@error="thumbnailFailed = true"
				/>
				<span v-else class="lucide-blocks size-8 text-ink-gray-4" aria-hidden="true" />
			</div>
			<div
				class="p-3"
				:class="
					isPython
						? project.is_submitted
							? 'pr-24'
							: 'pr-11'
						: 'border-t border-outline-gray-1'
				"
			>
				<p
					class="line-clamp-2 break-words text-base text-ink-gray-8"
					:title="project.project_title"
				>
					{{ project.project_title }}
				</p>
				<div class="mt-1 flex items-center gap-2">
					<span class="text-sm text-ink-gray-5">{{ savedLabel }}</span>
					<Badge
						v-if="isPython && project.is_shared"
						label="Shared"
						theme="blue"
						variant="subtle"
					/>
				</div>
			</div>
			<pre
				v-if="isPython && project.code_preview"
				class="mx-3 mb-3 overflow-hidden rounded-2 bg-surface-gray-2 px-2.5 py-2 font-mono text-xs leading-4 text-ink-gray-7"
				v-text="project.code_preview"
			/>
		</router-link>

		<Badge
			v-if="!isPython && project.is_shared"
			class="absolute left-2 top-2"
			label="Shared"
			theme="blue"
			variant="subtle"
		/>
		<Badge
			v-if="project.is_submitted"
			class="absolute right-2 top-2"
			label="Submitted"
			theme="green"
			variant="subtle"
		/>
		<div v-else class="absolute right-2 top-2">
			<Dropdown :options="actions" align="end">
				<Button
					icon="lucide-ellipsis"
					:aria-label="`Actions for ${project.project_title}`"
				/>
			</Dropdown>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge, Button, Dropdown } from 'frappe-ui'
import { projectEditorPath, useProjectsPath } from '@/composables/useProjectsPath'
import { useSession } from '@/composables/useSession'
import { formatDateTime } from '@/lib/dates'
import type { CS17Project } from '@/types'

const props = defineProps<{ project: CS17Project & { is_shared?: 0 | 1 } }>()

const emit = defineEmits<{
	rename: [project: CS17Project]
	delete: [project: CS17Project]
	share: [project: CS17Project]
	unshare: [project: CS17Project]
}>()

const projectsPath = useProjectsPath()
const { isStudent } = useSession()

const thumbnailFailed = ref(false)
const isPython = computed(() => props.project.project_type === 'Python')

const shareAction = computed(() =>
	props.project.is_shared
		? {
				label: 'Stop sharing',
				icon: 'lucide-eye-off',
				onClick: () => emit('unshare', props.project),
			}
		: {
				label: 'Share with class',
				icon: 'lucide-share-2',
				onClick: () => emit('share', props.project),
			},
)

const actions = computed(() => [
	{ label: 'Rename', icon: 'lucide-pencil', onClick: () => emit('rename', props.project) },
	...(isStudent.value && !props.project.assignment ? [shareAction.value] : []),
	{
		label: 'Delete',
		icon: 'lucide-trash-2',
		theme: 'red' as const,
		onClick: () => emit('delete', props.project),
	},
])

// A project exists before it holds anything: `create_project` inserts the
// document and the editor only attaches an `.sb3` on the first save.
const savedLabel = computed(() =>
	props.project.last_saved_at
		? `Saved ${formatDateTime(props.project.last_saved_at)}`
		: 'Not saved yet',
)
</script>
