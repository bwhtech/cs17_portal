<template>
	<div v-if="leaves.data" class="space-y-1.5">
		<p class="flex items-center gap-1.5 text-base text-ink-gray-8">
			<span
				:class="[
					leaves.data.length
						? 'lucide-eye-off text-ink-amber-7'
						: 'lucide-eye text-ink-gray-5',
					'size-4 shrink-0',
				]"
				aria-hidden="true"
			/>
			{{ summary }}
		</p>
		<ul v-if="leaves.data.length" class="space-y-0.5 pl-6 text-sm text-ink-gray-5">
			<li v-for="leave in leaves.data" :key="leave.left_at">
				{{ formatDateTime(leave.left_at) }} ·
				{{
					leave.returned_at ? `${awayText(secondsAway(leave))} away` : 'did not come back'
				}}
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCall } from 'frappe-ui'
import { formatDateTime, parseDatetime } from '@/lib/dates'

interface TabLeave {
	left_at: string
	returned_at: string | null
}

const props = defineProps<{ submission: string }>()

const leaves = useCall<TabLeave[], { submission: string }>({
	url: '/api/v2/method/cs17_portal.api.get_tab_leaves',
	params: () => ({ submission: props.submission }),
})

function secondsAway(leave: TabLeave): number {
	if (!leave.returned_at) return 0
	const away = parseDatetime(leave.returned_at).valueOf() - parseDatetime(leave.left_at).valueOf()
	return Math.round(away / 1000)
}

function awayText(seconds: number): string {
	const minutes = Math.floor(seconds / 60)
	if (!minutes) return `${seconds} s`
	return seconds % 60 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`
}

const summary = computed(() => {
	const count = leaves.data?.length ?? 0
	if (!count) return 'Stayed on this tab'
	const total = leaves.data?.reduce((sum, leave) => sum + secondsAway(leave), 0) ?? 0
	return `Left the tab ${count} ${count === 1 ? 'time' : 'times'}, ${awayText(total)} away`
})
</script>
