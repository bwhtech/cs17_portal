<template>
	<div v-if="pastes.data" class="space-y-1.5">
		<p class="flex items-center gap-1.5 text-base text-ink-gray-8">
			<span
				:class="[
					pastes.data.length
						? 'lucide-clipboard-paste text-ink-amber-7'
						: 'lucide-clipboard text-ink-gray-5',
					'size-4 shrink-0',
				]"
				aria-hidden="true"
			/>
			{{ summary }}
		</p>
		<ul v-if="pastes.data.length" class="space-y-0.5 pl-6 text-sm text-ink-gray-5">
			<li v-for="paste in pastes.data" :key="paste.pasted_at">
				<details>
					<summary
						class="cursor-pointer rounded-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
					>
						{{ formatDateTime(paste.pasted_at) }} · {{ paste.line_count }}
						{{ paste.line_count === 1 ? 'line' : 'lines' }}
					</summary>
					<pre
						class="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-2 bg-surface-gray-2 p-2 font-mono text-sm text-ink-gray-8"
						v-text="paste.text"
					/>
				</details>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCall } from 'frappe-ui'
import { formatDateTime } from '@/lib/dates'

interface Paste {
	pasted_at: string
	line_count: number
	text: string
}

const props = defineProps<{ submission: string }>()

const pastes = useCall<Paste[], { submission: string }>({
	url: '/api/v2/method/cs17_portal.pastes.get_pastes',
	params: () => ({ submission: props.submission }),
})

const summary = computed(() => {
	const count = pastes.data?.length ?? 0
	return count ? `Pasted code ${count} ${count === 1 ? 'time' : 'times'}` : 'No code pasted'
})
</script>
