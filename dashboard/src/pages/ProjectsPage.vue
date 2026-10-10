<template>
	<AppHeader title="Projects">
		<template #actions>
			<Button
				variant="solid"
				theme="gray"
				:icon-left="isDesktop ? 'lucide-plus' : undefined"
				:icon="isDesktop ? undefined : 'lucide-plus'"
				label="New project"
				:loading="createProject.loading"
				@click="promptForNewProject"
			/>
		</template>
	</AppHeader>

	<PageBody width="wide" class="space-y-5">
		<LoadError
			v-if="failed"
			title="Could not load your projects"
			@retry="projectList.reload()"
		/>

		<div
			v-else-if="loading"
			class="cs17-delay-in grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
		>
			<Skeleton v-for="n in 3" :key="n" class="h-56 rounded-4" />
		</div>

		<EmptyState
			v-else-if="!projects.length"
			icon="lucide-blocks"
			title="No projects yet"
			description="Create your first Scratch project to get started."
		/>

		<div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<ProjectCard
				v-for="project in projects"
				:key="project.name"
				:project="project"
				@rename="promptForRename"
				@delete="confirmDelete"
			/>
		</div>
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Skeleton, dialog, toast, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import ProjectCard from '@/components/projects/ProjectCard.vue'
import { useProjectsPath } from '@/composables/useProjectsPath'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { CS17Project } from '@/types'

const router = useRouter()
const { isDesktop } = useBreakpoint()
const projectsPath = useProjectsPath()

const projectList = useCall<CS17Project[]>({
	url: '/api/v2/method/cs17_portal.api.list_my_projects',
})

const createProject = useCall<{ name: string }, { project_title: string }>({
	url: '/api/v2/method/cs17_portal.api.create_project',
	method: 'POST',
	immediate: false,
})

const renameProject = useCall<{ name: string }, { project: string; project_title: string }>({
	url: '/api/v2/method/cs17_portal.api.rename_project',
	method: 'POST',
	immediate: false,
})

const deleteProject = useCall<null, { project: string }>({
	url: '/api/v2/method/cs17_portal.api.delete_project',
	method: 'POST',
	immediate: false,
})

const projects = computed(() => projectList.data ?? [])
const loading = computed(() => projectList.loading && !projectList.data)
const failed = computed(() => Boolean(projectList.error) && !projectList.data)

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
			router.push(`${projectsPath}/${created.name}/edit`)
		},
	})
}

function promptForRename(project: CS17Project) {
	dialog.prompt({
		title: 'Rename project',
		fields: [
			{
				name: 'project_title',
				label: 'Project name',
				defaultValue: project.project_title,
				required: true,
			},
		],
		confirmLabel: 'Rename',
		onConfirm: async ({ values }) => {
			const title = String(values.project_title ?? '').trim()
			if (!title) throw new Error('Give the project a name.')

			await renameProject.submit({ project: project.name, project_title: title })
			if (renameProject.error) {
				throw new Error(
					frappeErrorMessage(renameProject.error, 'Could not rename the project.'),
				)
			}
			toast.success('Project renamed')
			projectList.reload()
		},
	})
}

function confirmDelete(project: CS17Project) {
	dialog.danger({
		title: 'Delete project',
		message: `Delete "${project.project_title}"? This cannot be undone.`,
		confirmLabel: 'Delete',
		onConfirm: async () => {
			await deleteProject.submit({ project: project.name })
			if (deleteProject.error) {
				throw new Error(
					frappeErrorMessage(deleteProject.error, 'Could not delete the project.'),
				)
			}
			toast.success('Project deleted')
			projectList.reload()
		},
	})
}
</script>
