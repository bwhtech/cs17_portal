<template>
	<div class="space-y-4">
		<FormControl
			type="select"
			label="Publishing"
			:options="modeOptions"
			:description="hint"
			:model-value="mode"
			@update:model-value="emit('update:mode', $event as PublishMode)"
		/>

		<DateTimePicker
			v-if="mode === 'schedule'"
			label="Publish on"
			placeholder="Pick a date and time"
			:min="now"
			:model-value="publishOn"
			@update:model-value="emit('update:publishOn', $event ?? '')"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DateTimePicker, FormControl, dayjsLocal } from 'frappe-ui'
import type { PublishMode } from '@/types'

const props = withDefaults(
	defineProps<{
		mode: PublishMode
		/** A Frappe datetime, "YYYY-MM-DD HH:mm:ss". Only read while scheduling. */
		publishOn: string
		/** Offer "Save as draft". Off where a draft makes no sense (republishing). */
		includeDraft?: boolean
		published?: boolean
		/** Helper text under the mode select. */
		hint?: string
	}>(),
	{ includeDraft: false, published: false },
)

const emit = defineEmits<{
	'update:mode': [value: PublishMode]
	'update:publishOn': [value: string]
}>()

const ALL_MODES = [
	{ value: 'draft', label: 'Save as draft' },
	{ value: 'now', label: 'Publish now' },
	{ value: 'schedule', label: 'Schedule' },
]

const now = dayjsLocal().format('YYYY-MM-DD HH:mm:ss')

const modeOptions = computed(() =>
	ALL_MODES.filter(
		(option) =>
			(props.includeDraft || option.value !== 'draft') &&
			!(props.published && option.value === 'schedule'),
	),
)
</script>
