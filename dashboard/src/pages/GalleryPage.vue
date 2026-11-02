<template>
	<AppHeader title="Gallery" />

	<PageBody width="wide" class="space-y-5">
		<LoadError
			v-if="failed"
			title="Could not load the gallery"
			:loading="gallery.loading"
			@retry="gallery.reload()"
		/>

		<div
			v-else-if="loading"
			class="cs17-delay-in grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
		>
			<Skeleton v-for="n in 3" :key="n" class="h-56 rounded-4" />
		</div>

		<EmptyState
			v-else-if="!projects.length"
			icon="lucide-images"
			title="No shared projects yet"
			:description="
				isFaculty
					? 'Projects your students share show up here.'
					: 'Share a practice project from Projects to show it here.'
			"
		/>

		<div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<GalleryCard
				v-for="project in projects"
				:key="project.name"
				:project="project"
				@open="openProject(project)"
			/>
		</div>
	</PageBody>

	<GalleryProjectDialog
		v-if="selected"
		v-model:open="dialogOpen"
		:project="selected"
		@unshared="gallery.reload()"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Skeleton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import GalleryCard from '@/components/gallery/GalleryCard.vue'
import GalleryProjectDialog from '@/components/gallery/GalleryProjectDialog.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { useSession } from '@/composables/useSession'
import type { SharedProject } from '@/components/gallery/sharedProject'

const { isFaculty } = useSession()

const gallery = useCall<SharedProject[]>({
	url: '/api/v2/method/cs17_portal.gallery.get_shared_projects',
})

const projects = computed(() => gallery.data ?? [])
const loading = computed(() => gallery.loading && !gallery.data)
const failed = useLoadFailed(gallery)

const selected = ref<SharedProject | null>(null)
const dialogOpen = ref(false)

function openProject(project: SharedProject) {
	selected.value = project
	dialogOpen.value = true
}
</script>
