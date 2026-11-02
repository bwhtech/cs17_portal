<template>
	<Badge
		:theme="passed === total ? 'green' : 'red'"
		variant="subtle"
		:title="`${passed} of ${total} ${total === 1 ? 'test' : 'tests'} passed`"
	>
		<template #prefix>
			<span class="lucide-list-checks size-full" aria-hidden="true" />
		</template>
		{{ passed }} of {{ total }}
	</Badge>
</template>

<script setup lang="ts">
import { Badge } from 'frappe-ui'

defineProps<{ passed: number; total: number }>()
</script>
