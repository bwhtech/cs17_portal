<template>
	<div class="space-y-4">
		<div class="flex flex-wrap items-center gap-3">
			<Avatar size="2xl" :image="picture ?? undefined" :label="fullName" />
			<FileUploader
				:private="false"
				file-types="image/*"
				@success="onUploaded"
				@failure="onUploadFailed"
			>
				<template #default="{ uploading, progress, openFileSelector }">
					<Button
						:loading="uploading"
						:label="uploading ? `Uploading ${progress}%` : 'Change photo'"
						icon-left="lucide-upload"
						@click="openFileSelector"
					/>
				</template>
			</FileUploader>
			<Button
				v-if="picture"
				icon-left="lucide-trash-2"
				label="Remove photo"
				class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
				@click="picture = null"
			/>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<FormControl v-model="firstName" label="First name" required />
			<FormControl v-model="lastName" label="Last name" required />
		</div>

		<ErrorMessage :message="error ?? undefined" />

		<Button variant="solid" label="Save" :loading="saveCall.loading" @click="save" />
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Avatar,
	Button,
	ErrorMessage,
	FileUploader,
	FormControl,
	toast,
	useCall,
	type UploadedFile,
} from 'frappe-ui'
import { useSession } from '@/composables/useSession'
import { useSettingsDialog } from '@/composables/useSettingsDialog'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { CS17Profile } from '@/types'

type SavedProfile = Pick<
	CS17Profile,
	'name' | 'full_name' | 'first_name' | 'last_name' | 'profile_picture'
>

const { profile } = useSession()
const { isOpen } = useSettingsDialog()

const firstName = ref('')
const lastName = ref('')
const picture = ref<string | null>(null)
const error = ref<string | null>(null)

const fullName = computed(() => `${firstName.value} ${lastName.value}`.trim())

const isChanged = computed(
	() =>
		firstName.value.trim() !== profile.value?.first_name ||
		lastName.value.trim() !== profile.value?.last_name ||
		picture.value !== (profile.value?.profile_picture ?? null),
)
const missingNames = computed(() =>
	[!firstName.value.trim() && 'first name', !lastName.value.trim() && 'last name'].filter(
		Boolean,
	),
)

const saveCall = useCall<
	SavedProfile,
	{ first_name: string; last_name: string; profile_picture: string }
>({
	url: '/api/v2/method/cs17_portal.api.update_my_profile',
	method: 'POST',
	immediate: false,
})

watch(isOpen, (open) => open && reset(), { immediate: true })

function reset() {
	firstName.value = profile.value?.first_name ?? ''
	lastName.value = profile.value?.last_name ?? ''
	picture.value = profile.value?.profile_picture ?? null
	error.value = null
}

function onUploaded(file: UploadedFile) {
	error.value = null
	picture.value = file.file_url
}

function onUploadFailed(uploadError: unknown) {
	error.value = frappeErrorMessage(uploadError, 'Could not upload that photo. Please try again.')
}

async function save() {
	error.value = null
	if (missingNames.value.length) {
		error.value = `Add your ${missingNames.value.join(' and ')}.`
		return
	}
	if (!isChanged.value) {
		toast.info('Nothing to save yet.')
		return
	}
	await saveCall.submit({
		first_name: firstName.value.trim(),
		last_name: lastName.value.trim(),
		profile_picture: picture.value ?? '',
	})
	if (saveCall.error || !saveCall.data || !profile.value) {
		error.value = frappeErrorMessage(saveCall.error, 'Could not save your profile.')
		return
	}
	profile.value = { ...profile.value, ...saveCall.data }
	reset()
	toast.success('Profile saved')
}
</script>
