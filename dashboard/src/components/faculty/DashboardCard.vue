<template>
	<section
		class="min-w-0 space-y-4 rounded-4 border border-outline-gray-1 bg-surface-base p-5"
		:aria-labelledby="titleId"
	>
		<div class="flex min-h-7 items-center justify-between gap-3">
			<h2 :id="titleId" class="text-lg-semibold text-ink-gray-8">{{ title }}</h2>
			<slot name="action" />
		</div>

		<ErrorMessage v-if="error" :message="error" />

		<div v-else-if="loading" class="cs17-delay-in space-y-3">
			<Skeleton v-for="n in 3" :key="n" class="h-8 w-full rounded-4" />
		</div>

		<p v-else-if="empty" class="text-p-sm text-ink-gray-5">{{ empty }}</p>

		<slot v-else />
	</section>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { ErrorMessage, Skeleton } from 'frappe-ui'

defineProps<{
	title: string
	error?: string
	loading?: boolean
	empty?: string
}>()

const titleId = useId()
</script>
