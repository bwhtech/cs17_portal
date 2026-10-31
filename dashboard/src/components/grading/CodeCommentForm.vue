<template>
	<form ref="form" class="space-y-2" novalidate @submit.prevent="emit('save')">
		<FormControl v-model="text" type="textarea" :label="label" :rows="2" :error="error" />
		<div class="flex justify-end gap-2">
			<Button label="Cancel" @click="emit('cancel')" />
			<Button type="submit" label="Save" :loading="loading" />
		</div>
	</form>
</template>

<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import { Button, FormControl } from 'frappe-ui'

const text = defineModel<string>({ required: true })

defineProps<{ label: string; error: string; loading: boolean }>()

const emit = defineEmits<{ save: []; cancel: [] }>()

const form = useTemplateRef<HTMLFormElement>('form')

onMounted(() => form.value?.querySelector('textarea')?.focus())
</script>
