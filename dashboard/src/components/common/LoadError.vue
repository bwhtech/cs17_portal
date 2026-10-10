<template>
	<EmptyState icon="lucide-triangle-alert" :title="title">
		<template #action>
			<Button label="Try again" @click="emit('retry')" />
		</template>
	</EmptyState>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps<{ title: string }>()

const emit = defineEmits<{ retry: [] }>()
</script>
