<template>
	<!-- frappe-ui's own Avatar, in its square shape and themed fallback: the
	     default slot takes an icon in place of initials. -->
	<Avatar size="lg" shape="square" :theme="config.theme" :label="submissionType ?? 'Any'">
		<span :class="config.icon" aria-hidden="true" />
	</Avatar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Avatar } from 'frappe-ui'
import type { AvatarTheme } from 'frappe-ui'
import type { SubmissionType } from '@/types'

const props = defineProps<{ submissionType?: SubmissionType | null }>()

/** What the student has to hand in, at a glance. */
const TYPES: Record<SubmissionType, { icon: string; theme: AvatarTheme }> = {
	PDF: { icon: 'lucide-file-text', theme: 'red' },
	URL: { icon: 'lucide-link', theme: 'blue' },
	Image: { icon: 'lucide-image', theme: 'violet' },
	ZIP: { icon: 'lucide-file-archive', theme: 'amber' },
	Scratch: { icon: 'lucide-blocks', theme: 'green' },
	Any: { icon: 'lucide-file', theme: 'gray' },
}

const config = computed(() => TYPES[props.submissionType ?? 'Any'] ?? TYPES.Any)
</script>
