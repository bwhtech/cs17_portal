<template>
	<Dropdown v-if="models.length > 1" :options="options" side="top">
		<Button v-bind="$attrs" />
	</Dropdown>
	<Button v-else v-bind="$attrs" @click="emit('check', models[0])" />
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { Button, Dropdown } from 'frappe-ui'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
	/** The default model first, then the others faculty can pick. */
	models: string[]
}>()

const emit = defineEmits<{ check: [model: string] }>()

const options = computed(() =>
	props.models.map((model, index) => ({
		label: model.slice(model.lastIndexOf('/') + 1),
		slots: index
			? undefined
			: { suffix: () => h('span', { class: 'text-sm text-ink-gray-5' }, 'Default') },
		onClick: () => emit('check', model),
	})),
)
</script>
