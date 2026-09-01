<template>
	<AppHeader title="Projects" />

	<div class="px-3 py-5 pb-10 sm:px-5">
		<div class="mx-auto max-w-[940px] space-y-5">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h1 class="text-2xl text-ink-gray-9">Projects</h1>
					<p v-if="!loading" class="mt-1.5 text-sm text-ink-gray-5">{{ countLabel }}</p>
				</div>
				<Button
					variant="solid"
					theme="gray"
					icon-left="lucide-plus"
					label="New project"
					:loading="createProject.loading"
					@click="promptForNewProject"
				/>
			</div>

			<div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Skeleton v-for="n in 3" :key="n" class="h-56 rounded-4" />
			</div>

			<EmptyState
				v-else-if="!projects.length"
				icon="lucide-blocks"
				title="No projects yet"
				description="Create your first Scratch project to get started."
			>
				<template #action>
					<Button
						variant="solid"
						theme="gray"
						icon-left="lucide-plus"
						label="New project"
						:loading="createProject.loading"
						@click="promptForNewProject"
					/>
				</template>
			</EmptyState>

			<div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<ProjectCard v-for="project in projects" :key="project.name" :project="project" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Skeleton, dialog, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ProjectCard from '@/components/projects/ProjectCard.vue'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { CS17Project } from '@/types'

const router = useRouter()

const projectList = useCall<CS17Project[]>({
	url: '/api/v2/method/cs17_portal.api.list_my_projects',
})

const createProject = useCall<{ name: string }, { project_title: string }>({
	url: '/api/v2/method/cs17_portal.api.create_project',
	method: 'POST',
	immediate: false,
})

const projects = computed(() => projectList.data ?? [])
const loading = computed(() => projectList.loading && !projectList.data)
const countLabel = computed(
	() => `${projects.value.length} project${projects.value.length === 1 ? '' : 's'}`,
)

/**
 * The name is asked for up front because a Scratch project is only ever
 * opened from this grid — an untitled card is unfindable a week later.
 */
function promptForNewProject() {
	dialog.prompt({
		title: 'New project',
		fields: [
			{
				name: 'project_title',
				label: 'Project name',
				placeholder: 'Maze game',
				required: true,
			},
		],
		confirmLabel: 'Create',
		onConfirm: async ({ values }) => {
			const title = String(values.project_title ?? '').trim()
			if (!title) throw new Error('Give the project a name.')

			// `submit()` resolves rather than throwing, so the error ref is what
			// says whether this call landed.
			const created = await createProject.submit({ project_title: title })
			if (createProject.error || !created) {
				throw new Error(
					frappeErrorMessage(createProject.error, 'Could not create the project.'),
				)
			}

			// The grid refreshes behind us; we leave for the editor either way.
			projectList.reload()
			router.push(`/projects/${created.name}/edit`)
		},
	})
}
</script>
