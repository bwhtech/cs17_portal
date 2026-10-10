<template>
	<!-- The menu sits beside the link, not inside it: a button in an anchor
	     would open the editor on every click. -->
	<div class="relative">
		<router-link
			:to="`${projectsPath}/${project.name}/edit`"
			class="block overflow-hidden rounded-4 border border-outline-gray-1 bg-surface-base transition-colors hover:border-outline-gray-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
		>
			<div class="flex aspect-[4/3] items-center justify-center bg-surface-gray-2">
				<img
					v-if="project.thumbnail"
					:src="project.thumbnail"
					alt=""
					class="h-full w-full object-cover"
				/>
				<span v-else class="lucide-blocks size-8 text-ink-gray-4" aria-hidden="true" />
			</div>
			<div class="border-t border-outline-gray-1 p-3">
				<p class="truncate text-base text-ink-gray-8">{{ project.project_title }}</p>
				<p class="mt-1 text-sm text-ink-gray-5">{{ savedLabel }}</p>
			</div>
		</router-link>

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
import { computed } from 'vue'
import { Badge, Button, Dropdown } from 'frappe-ui'
import { useProjectsPath } from '@/composables/useProjectsPath'
import { formatDateTime } from '@/lib/dates'
import type { CS17Project } from '@/types'

const props = defineProps<{ project: CS17Project }>()

const emit = defineEmits<{
	rename: [project: CS17Project]
	delete: [project: CS17Project]
}>()

const projectsPath = useProjectsPath()

const actions = [
	{ label: 'Rename', icon: 'lucide-pencil', onClick: () => emit('rename', props.project) },
	{
		label: 'Delete',
		icon: 'lucide-trash-2',
		theme: 'red' as const,
		onClick: () => emit('delete', props.project),
	},
]

// A project exists before it holds anything: `create_project` inserts the
// document and the editor only attaches an `.sb3` on the first save.
const savedLabel = computed(() =>
	props.project.last_saved_at
		? `Saved ${formatDateTime(props.project.last_saved_at)}`
		: 'Not saved yet',
)
</script>
