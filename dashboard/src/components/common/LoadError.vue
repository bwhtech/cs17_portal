<template>
	<EmptyState icon="lucide-triangle-alert" :title="title">
		<template #action>
			<Button label="Try again" :loading="retrying" @click="retry" />
		</template>
	</EmptyState>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'

const props = defineProps<{ title: string; loading?: boolean }>()

const emit = defineEmits<{ retry: [] }>()

const retrying = ref(false)

function retry() {
	retrying.value = true
	emit('retry')
}

watch(
	() => props.loading,
	(loading) => {
		if (!loading) retrying.value = false
	},
)
</script>
