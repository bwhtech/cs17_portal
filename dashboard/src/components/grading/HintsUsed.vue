<template>
	<div v-if="hints.data?.length" class="space-y-1.5">
		<p class="flex items-center gap-1.5 text-base text-ink-gray-8">
			<span class="lucide-lightbulb size-4 shrink-0 text-ink-amber-7" aria-hidden="true" />
			Hints used
		</p>
		<ul class="space-y-2 pl-6">
			<li v-for="hint in hints.data" :key="hint.asked_at">
				<p class="text-sm text-ink-gray-5">{{ formatDateTime(hint.asked_at) }}</p>
				<p
					class="whitespace-pre-wrap break-words text-p-sm text-ink-gray-8"
					v-text="hint.hint"
				/>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { useCall } from 'frappe-ui'
import type { Hint } from '@/components/python/PythonHints.vue'
import { formatDateTime } from '@/lib/dates'

const props = defineProps<{ submission: string }>()

const hints = useCall<Hint[], { submission: string }>({
	url: '/api/v2/method/cs17_portal.hints.get_hints',
	params: () => ({ submission: props.submission }),
})
</script>
