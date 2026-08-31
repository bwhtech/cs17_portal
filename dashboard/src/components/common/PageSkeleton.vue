<template>
	<!-- The page's own silhouette while its first request is in flight, so the
	     content lands in place rather than replacing a centred spinner. -->
	<div class="space-y-4">
		<Skeleton class="h-5 w-48 rounded-full" />
		<Skeleton v-for="n in blocks" :key="n" class="h-24 rounded-5" />
	</div>
</template>

<script setup lang="ts">
import { Skeleton } from 'frappe-ui'

withDefaults(defineProps<{ blocks?: number }>(), { blocks: 3 })
</script>
