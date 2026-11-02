<template>
	<section v-if="hints.length || canAsk" class="space-y-2" aria-label="Hints">
		<ol class="space-y-2" aria-live="polite">
			<li
				v-for="(hint, index) in hints"
				:key="hint.asked_at"
				class="rounded-4 border border-outline-gray-1 bg-surface-gray-1 px-3 py-2"
			>
				<p class="flex items-center gap-1.5 text-sm text-ink-gray-5">
					<span
						class="lucide-lightbulb size-4 shrink-0 text-ink-amber-7"
						aria-hidden="true"
					/>
					Hint {{ index + 1 }} of {{ maxHints }}
				</p>
				<p
					class="mt-1 whitespace-pre-wrap break-words text-p-sm text-ink-gray-8"
					v-text="hint.hint"
				/>
			</li>
		</ol>
		<Button
			v-if="canAsk"
			icon-left="lucide-lightbulb"
			label="Get a hint"
			:loading="asking"
			@click="emit('ask')"
		/>
	</section>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'

export interface Hint {
	hint: string
	asked_at: string
}

export interface HintState {
	enabled: true
	after_failed_runs: number
	max_hints: number
	failed_runs: number
	hints: Hint[]
	hints_left: number
	unlocked: boolean
}

defineProps<{ hints: Hint[]; maxHints: number; canAsk: boolean; asking: boolean }>()

const emit = defineEmits<{ ask: [] }>()
</script>
