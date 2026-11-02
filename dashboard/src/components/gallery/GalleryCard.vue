<template>
	<button
		type="button"
		class="block w-full overflow-hidden rounded-4 border border-outline-gray-1 bg-surface-base text-left transition-colors hover:border-outline-gray-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
		@click="emit('open')"
	>
		<span class="flex aspect-[4/3] items-center justify-center bg-surface-gray-2">
			<img
				v-if="project.thumbnail && !thumbnailFailed"
				:src="thumbnailUrl"
				alt=""
				loading="lazy"
				class="h-full w-full object-cover"
				@error="thumbnailFailed = true"
			/>
			<span
				v-else
				:class="[
					project.project_type === 'Python' ? 'lucide-code' : 'lucide-blocks',
					'size-8 text-ink-gray-4',
				]"
				aria-hidden="true"
			/>
		</span>
		<span class="block border-t border-outline-gray-1 p-3">
			<span
				class="line-clamp-2 break-words text-base text-ink-gray-8"
				:title="project.project_title"
			>
				{{ project.project_title }}
			</span>
			<span class="mt-1 block truncate text-sm text-ink-gray-5">
				{{ project.student_name }}
			</span>
			<span class="mt-1 block text-sm text-ink-gray-5">{{ details }}</span>
		</span>
	</button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDateTime } from '@/lib/dates'
import type { SharedProject } from '@/components/gallery/sharedProject'

const props = defineProps<{ project: SharedProject }>()

const emit = defineEmits<{ open: [] }>()

const thumbnailFailed = ref(false)

const thumbnailUrl = computed(
	() =>
		`/api/method/cs17_portal.gallery.get_shared_thumbnail?${new URLSearchParams({ project: props.project.name })}`,
)

const details = computed(() => {
	const saved = props.project.last_saved_at
		? `Saved ${formatDateTime(props.project.last_saved_at)}`
		: 'Not saved yet'
	return `${props.project.project_type} · ${saved}`
})
</script>
