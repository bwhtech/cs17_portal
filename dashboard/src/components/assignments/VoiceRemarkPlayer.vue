<template>
	<div>
		<p class="text-xs text-ink-gray-5">Voice note</p>
		<audio v-if="voiceRemark.data" :src="voiceRemark.data" controls class="mt-1 h-8 w-full" />
		<ErrorMessage
			v-else-if="voiceRemark.error"
			class="mt-1"
			message="Could not load the voice note."
		/>
		<div v-else class="cs17-delay-in mt-1">
			<Skeleton class="h-8 w-full rounded-2" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ErrorMessage, Skeleton, useCall } from 'frappe-ui'

const props = defineProps<{ submission: string }>()

const voiceRemark = useCall<string, { submission: string }>({
	url: '/api/v2/method/cs17_portal.voice_remarks.get_voice_remark',
	method: 'GET',
	params: () => ({ submission: props.submission }),
	refetch: true,
})
</script>
