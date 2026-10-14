<template>
	<PanelLayout title="Profile">
		<div class="space-y-11 pt-6">
			<section class="space-y-6">
				<div class="flex items-center gap-4">
					<template v-if="isFaculty">
						<input
							ref="photoInput"
							type="file"
							class="hidden"
							accept="image/png,image/jpeg"
							@change="selectPhoto"
						/>
						<Dropdown
							v-if="profile?.profile_picture"
							:options="photoOptions"
							align="start"
						>
							<Button
								class="!size-16 !rounded-full !p-0"
								variant="ghost"
								aria-label="Profile picture options"
							>
								<Avatar class="size-16" size="3xl" v-bind="avatar" />
							</Button>
						</Dropdown>
						<Button
							v-else
							class="!size-16 !rounded-full !p-0"
							variant="ghost"
							aria-label="Upload profile picture"
							@click="photoInput?.click()"
						>
							<Avatar class="size-16" size="3xl" v-bind="avatar" />
						</Button>
						<div>
							<p class="text-base font-medium text-ink-gray-8">Profile picture</p>
							<p class="mt-1 text-p-sm text-ink-gray-5">Helps people recognise you</p>
						</div>
					</template>
					<template v-else>
						<Avatar class="size-16" size="3xl" v-bind="avatar" />
						<div class="min-w-0">
							<p class="break-words text-base font-medium text-ink-gray-8">
								{{ profile?.full_name ?? '—' }}
							</p>
							<p class="mt-1 break-words text-p-sm text-ink-gray-5">{{ roleLine }}</p>
						</div>
					</template>
				</div>

				<div v-if="isFaculty" class="grid gap-6 sm:grid-cols-2">
					<FormControl
						v-model="firstName"
						label="First name"
						:maxlength="NAME_MAX_LENGTH"
						:error="firstNameError"
						required
						@blur="saveName"
					/>
					<FormControl
						v-model="lastName"
						label="Last name"
						:maxlength="NAME_MAX_LENGTH"
						:error="lastNameError"
						required
						@blur="saveName"
					/>
				</div>
			</section>

			<section>
				<h2 class="text-lg font-semibold text-ink-gray-8">Account</h2>
				<SettingsRow
					class="mt-2"
					title="Log out"
					description="End this session and return to the login page."
				>
					<Button theme="red" variant="subtle" label="Log out" @click="confirmLogout" />
				</SettingsRow>
			</section>
		</div>
	</PanelLayout>

	<Dialog v-model:open="showPhotoEditor" title="Edit photo" @after-leave="photoFile = null">
		<div v-if="photoFile" class="space-y-5">
			<AvatarCropper ref="cropper" :file="photoFile" />
			<ErrorMessage :message="photoError" />
			<div class="flex items-center justify-between gap-3">
				<Button label="Reset" @click="cropper?.resetCrop()" />
				<div class="flex items-center gap-2">
					<Button label="Cancel" @click="showPhotoEditor = false" />
					<Button
						variant="solid"
						label="Save"
						:loading="savingPhoto"
						@click="savePhoto"
					/>
				</div>
			</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import {
	Avatar,
	Button,
	Dialog,
	Dropdown,
	ErrorMessage,
	FormControl,
	SettingsRow,
	dialog,
	toast,
	upload,
	useCall,
} from 'frappe-ui'
import AvatarCropper from '@/components/settings/AvatarCropper.vue'
import PanelLayout from '@/components/settings/PanelLayout.vue'
import { useSession } from '@/composables/useSession'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Profile } from '@/types'

type ProfileEdit = { first_name: string; last_name: string; profile_picture: string }
type SavedProfile = Pick<
	CS17Profile,
	'name' | 'full_name' | 'first_name' | 'last_name' | 'profile_picture'
>

const FULL_NAME_MAX_LENGTH = 140
const NAME_MAX_LENGTH = Math.floor((FULL_NAME_MAX_LENGTH - 1) / 2)

const { profile, isFaculty, cohort, logout } = useSession()

const avatar = computed(() => ({
	image: profile.value?.profile_picture ?? undefined,
	label: profile.value?.full_name ?? '',
}))
const roleLine = computed(() => (cohort.value ? `cohort ${cohort.value}` : 'Student'))

const firstName = ref(profile.value?.first_name ?? '')
const lastName = ref(profile.value?.last_name ?? '')
const firstNameError = ref('')
const lastNameError = ref('')

const photoInput = useTemplateRef<HTMLInputElement>('photoInput')
const cropper = useTemplateRef<InstanceType<typeof AvatarCropper>>('cropper')
const photoFile = ref<File | null>(null)
const photoError = ref('')
const showPhotoEditor = ref(false)
const savingPhoto = ref(false)

const photoOptions = [
	{ label: 'Change photo', icon: 'lucide-image-up', onClick: () => photoInput.value?.click() },
	{ label: 'Remove photo', icon: 'lucide-trash-2', onClick: removePhoto },
]

const saveCall = useCall<SavedProfile, ProfileEdit>({
	url: '/api/v2/method/cs17_portal.api.update_my_profile',
	method: 'POST',
	immediate: false,
})

let lastSave: Promise<unknown> = Promise.resolve()

function save(edit: Partial<ProfileEdit>, fallback: string): Promise<string> {
	const failure = lastSave.then(async () => {
		if (!profile.value) return fallback
		await trySubmit(saveCall, {
			first_name: profile.value.first_name,
			last_name: profile.value.last_name,
			profile_picture: profile.value.profile_picture ?? '',
			...edit,
		})
		if (saveCall.error || !saveCall.data) return frappeErrorMessage(saveCall.error, fallback)
		profile.value = { ...profile.value, ...saveCall.data }
		return ''
	})
	lastSave = failure
	return failure
}

async function saveName() {
	const first = firstName.value.trim()
	const last = lastName.value.trim()
	firstNameError.value = first ? '' : 'Add your first name.'
	lastNameError.value = last ? '' : 'Add your last name.'
	if (!first || !last) return
	if (first === profile.value?.first_name && last === profile.value?.last_name) return

	const failure = await save({ first_name: first, last_name: last }, 'Could not save your name.')
	if (failure) toast.error(failure)
	else toast.success('Name saved', { id: 'name-saved' })
}

function selectPhoto(event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	if (!file) return
	if (!['image/png', 'image/jpeg'].includes(file.type)) {
		toast.error('Only PNG and JPG images are allowed')
		return
	}
	photoError.value = ''
	photoFile.value = file
	showPhotoEditor.value = true
}

async function savePhoto() {
	const blob = await cropper.value?.getCroppedBlob()
	if (!blob) {
		photoError.value = 'Could not crop that photo.'
		return
	}
	savingPhoto.value = true
	photoError.value = await uploadPhoto(
		new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' }),
	)
	savingPhoto.value = false
	if (!photoError.value) showPhotoEditor.value = false
}

async function uploadPhoto(photo: File): Promise<string> {
	try {
		const { file_url } = await upload(photo, { private: false })
		return save({ profile_picture: file_url }, 'Could not save your photo.')
	} catch (error) {
		return frappeErrorMessage(error, 'Could not upload that photo. Please try again.')
	}
}

async function removePhoto() {
	const failure = await save({ profile_picture: '' }, 'Could not remove your photo.')
	if (failure) toast.error(failure)
}

function confirmLogout() {
	dialog.danger({
		title: 'Log out',
		message: 'Are you sure you want to log out?',
		confirmLabel: 'Log out',
		onConfirm: () => logout(),
	})
}
</script>
