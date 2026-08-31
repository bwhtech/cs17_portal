<template>
	<div class="flex items-start gap-3 rounded-4 border p-4" :class="style.wrapper">
		<div
			class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-4"
			:class="style.iconBg"
		>
			<span :class="[style.icon, 'size-4', style.iconInk]" aria-hidden="true" />
		</div>

		<div class="min-w-0 flex-1">
			<p class="text-base-semibold text-ink-gray-8">{{ title?.trim() || placeholder }}</p>
			<div v-if="content?.trim()" class="mt-1">
				<MarkdownText :content="content" />
			</div>
		</div>

		<!-- Inert on purpose: this is a preview of the student's banner, and the
		     close affordance is part of what an author is checking. -->
		<span
			v-if="dismissible"
			class="lucide-x mt-1 size-4 shrink-0 text-ink-gray-5"
			aria-hidden="true"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownText from '@/components/common/MarkdownText.vue'
import type { AlertVariant } from '@/types'

const props = withDefaults(
	defineProps<{
		title?: string | null
		content?: string | null
		variant?: AlertVariant | string | null
		/** Draws the dismiss affordance, as a student would see it. */
		dismissible?: boolean
		/** Stand-in heading while the title field is still empty. */
		placeholder?: string
	}>(),
	{ variant: 'info', placeholder: 'Announcement title' },
)

/**
 * The variant is carried by the tint and the glyph, not by the text: gray
 * copy on a tinted ground is what the rest of the app does, and it survives
 * dark mode without a second palette.
 */
const VARIANT_STYLES = {
	info: {
		wrapper: 'bg-surface-blue-1 border-outline-blue-2',
		iconBg: 'bg-surface-blue-2',
		iconInk: 'text-ink-blue-5',
		icon: 'lucide-info',
	},
	warning: {
		wrapper: 'bg-surface-amber-1 border-outline-amber-2',
		iconBg: 'bg-surface-amber-2',
		iconInk: 'text-ink-amber-5',
		icon: 'lucide-zap',
	},
	error: {
		wrapper: 'bg-surface-red-1 border-outline-red-2',
		iconBg: 'bg-surface-red-2',
		iconInk: 'text-ink-red-5',
		icon: 'lucide-alert-triangle',
	},
} as const

const style = computed(
	() => VARIANT_STYLES[(props.variant ?? 'info') as AlertVariant] ?? VARIANT_STYLES.info,
)
</script>
