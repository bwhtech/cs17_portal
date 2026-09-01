<template>
	<div
		class="grid size-7 shrink-0 place-items-center rounded-4 bg-surface-gray-2 text-ink-gray-6"
		:title="submissionType ?? 'Any'"
	>
		<span :class="icon" class="size-4" aria-hidden="true" />
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SubmissionType } from '@/types'

const props = defineProps<{ submissionType?: SubmissionType | null }>()

// What the student is expected to hand in, at a glance. Gray, not themed:
// the type is a label, not a state, and the row's colour belongs to its badge.
const ICONS: Record<SubmissionType, string> = {
	PDF: 'lucide-file-text',
	URL: 'lucide-link',
	Image: 'lucide-image',
	ZIP: 'lucide-file-archive',
	Scratch: 'lucide-blocks',
	Any: 'lucide-file',
}

const icon = computed(() => ICONS[props.submissionType ?? 'Any'] ?? ICONS.Any)
</script>
