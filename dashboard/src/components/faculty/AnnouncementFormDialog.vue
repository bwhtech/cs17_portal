<template>
	<Dialog
		:open="open"
		:title="announcement ? 'Edit announcement' : 'New announcement'"
		message="Fill in the details; the preview shows how students will see it."
		size="4xl"
		@update:open="emit('update:open', $event)"
	>
		<template #default>
			<div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
				<div class="space-y-4">
					<FormControl
						v-model="form.title"
						label="Title"
						required
						placeholder="Announcement title"
						:error="fieldErrors.title"
					/>

					<Textarea
						v-model="form.content"
						label="Content"
						description="Markdown supported"
						placeholder="What do you want students to know?"
						:rows="6"
					/>

					<div class="grid gap-3 sm:grid-cols-2">
						<Select
							v-model="form.alert_variant"
							label="Variant"
							:options="variantOptions"
						/>
						<Select v-model="form.cohort" label="Cohort" :options="cohortOptions" />
					</div>

					<Switch
						v-model="form.is_dismissible"
						label="Dismissible"
						description="Students can close the banner and it stays closed."
					/>

					<PublishFields
						v-model:mode="mode"
						v-model:publish-on="publishOn"
						include-draft
						hint="A scheduled announcement appears to students at the chosen time."
					/>

					<ErrorMessage :message="formError" />
				</div>

				<div class="space-y-1.5">
					<p class="text-sm text-ink-gray-6">Preview</p>
					<AnnouncementPreview
						v-if="hasPreview"
						:title="form.title"
						:content="form.content"
						:variant="form.alert_variant"
						:dismissible="form.is_dismissible"
					/>
					<div
						v-else
						class="rounded-4 border border-dashed border-outline-gray-2 p-4 text-p-sm text-ink-gray-5"
					>
						Start typing to see a preview.
					</div>
				</div>
			</div>
		</template>

		<template #actions="{ close }">
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="close" />
				<Button
					variant="solid"
					theme="gray"
					:loading="saving"
					:label="announcement ? 'Save changes' : 'Save'"
					@click="save"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	Select,
	Switch,
	Textarea,
	useCall,
} from 'frappe-ui'
import AnnouncementPreview from '@/components/faculty/AnnouncementPreview.vue'
import PublishFields from '@/components/common/PublishFields.vue'
import { toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { ALERT_VARIANTS, type AlertVariant, type CS17Announcement, type PublishMode } from '@/types'

const props = defineProps<{
	open: boolean
	/** The row being edited, or `null` for a new announcement. */
	announcement?: CS17Announcement | null
	/** Cohort names; the form adds "All cohorts" itself. */
	cohorts: string[]
}>()

const emit = defineEmits<{
	'update:open': [value: boolean]
	saved: []
}>()

/** What `create_announcement` and `update_announcement` take. */
interface AnnouncementPayload {
	/** Only on an update. */
	announcement?: string
	title: string
	content: string
	alert_variant: AlertVariant
	cohort: string | null
	is_dismissible: 0 | 1
	publish: PublishMode
	publish_on: string
}

/** The Select needs a real value for "no cohort"; the API wants `null`. */
const ALL_COHORTS = '__all__'

const form = reactive({
	title: '',
	content: '',
	alert_variant: 'info' as AlertVariant,
	cohort: ALL_COHORTS,
	is_dismissible: true,
})

const mode = ref<PublishMode>('draft')
const publishOn = ref('')
const formError = ref('')
const fieldErrors = reactive({ title: '' })

const variantOptions = ALERT_VARIANTS.map((variant) => ({
	label: variant[0].toUpperCase() + variant.slice(1),
	value: variant,
}))

const cohortOptions = computed(() => [
	{ label: 'All cohorts', value: ALL_COHORTS },
	...props.cohorts.map((cohort) => ({ label: cohort, value: cohort })),
])

const hasPreview = computed(() => Boolean(form.title.trim() || form.content.trim()))

// `submit()` resolves whether or not the request failed — the error lands on
// the handle — so the failure path is wired through `onError`, and the caller
// only has to ask whether an error was set.
function onError(error: Error) {
	formError.value = frappeErrorMessage(error, 'Could not save the announcement.')
}

const createCall = useCall<string, AnnouncementPayload>({
	url: '/api/v2/method/cs17_portal.api.create_announcement',
	method: 'POST',
	immediate: false,
	onError,
})

const updateCall = useCall<string, AnnouncementPayload>({
	url: '/api/v2/method/cs17_portal.api.update_announcement',
	method: 'POST',
	immediate: false,
	onError,
})

const saving = computed(() => createCall.loading || updateCall.loading)

// Reloading on every open, not on mount: the dialog instance outlives a single
// row, so the previous announcement's values would otherwise leak into the next.
watch(
	() => props.open,
	(open) => {
		if (open) reset()
	},
)

function reset() {
	const row = props.announcement
	form.title = row?.title ?? ''
	form.content = row?.content ?? ''
	form.alert_variant = (row?.alert_variant ?? 'info') as AlertVariant
	form.cohort = row?.cohort || ALL_COHORTS
	form.is_dismissible = row ? Boolean(row.is_dismissible) : true
	mode.value = row?.publish_on ? 'schedule' : 'draft'
	// `DateTimePicker` speaks the same "YYYY-MM-DD HH:mm:ss" the API stores, so
	// a scheduled datetime goes in and comes back out untouched.
	publishOn.value = row?.publish_on ?? ''
	formError.value = ''
	fieldErrors.title = ''
}

async function save() {
	fieldErrors.title = form.title.trim() ? '' : 'Title is required.'
	formError.value = mode.value === 'schedule' && !publishOn.value ? 'Pick a publish date.' : ''
	if (fieldErrors.title || formError.value) return

	const payload: AnnouncementPayload = {
		title: form.title,
		content: form.content,
		alert_variant: form.alert_variant,
		cohort: form.cohort === ALL_COHORTS ? null : form.cohort,
		is_dismissible: form.is_dismissible ? 1 : 0,
		publish: mode.value,
		publish_on: toFrappeDatetime(publishOn.value),
	}

	const call = props.announcement ? updateCall : createCall
	await call.submit(
		props.announcement ? { announcement: props.announcement.name, ...payload } : payload,
	)
	if (call.error) return

	emit('saved')
	emit('update:open', false)
}
</script>
