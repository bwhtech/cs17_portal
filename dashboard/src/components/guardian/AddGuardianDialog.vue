<template>
	<Dialog :open="open" title="Add guardian" @update:open="emit('update:open', $event)">
		<div class="space-y-4">
			<FormControl v-model="fullName" label="Full name" :error="fullNameError" required />
			<FormControl
				v-model="email"
				type="email"
				label="Email"
				description="A new guardian gets an email to set their password. A guardian who is already here is linked to this student too."
				:error="emailError"
				required
			/>
			<ErrorMessage v-if="saveError" :message="saveError" />
		</div>

		<template #actions>
			<Button
				class="w-full"
				variant="solid"
				theme="gray"
				label="Add guardian"
				:loading="add.loading"
				@click="handleAdd"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

const props = defineProps<{ open: boolean; student: string }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const fullName = ref('')
const email = ref('')
const fullNameError = ref('')
const emailError = ref('')
const saveError = ref('')

const add = useCall<null, { student: string; full_name: string; email: string }>({
	url: '/api/v2/method/cs17_portal.guardian.add_guardian',
	method: 'POST',
	immediate: false,
})

watch(
	() => props.open,
	(open) => {
		if (!open) return
		fullName.value = ''
		email.value = ''
		fullNameError.value = ''
		emailError.value = ''
		saveError.value = ''
	},
)

watch(fullName, () => {
	fullNameError.value = ''
})

watch(email, () => {
	emailError.value = ''
})

async function handleAdd() {
	saveError.value = ''
	fullNameError.value = fullName.value.trim() ? '' : 'Enter their full name.'
	emailError.value = email.value.trim() ? '' : 'Enter their email.'
	if (fullNameError.value || emailError.value) return

	await trySubmit(add, {
		student: props.student,
		full_name: fullName.value.trim(),
		email: email.value.trim(),
	})

	if (add.error) {
		saveError.value = frappeErrorMessage(add.error, 'Could not add the guardian.')
		return
	}
	toast.success('Guardian added')
	emit('success')
	emit('update:open', false)
}
</script>
