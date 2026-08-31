<template>
	<!-- One body, two chromes: a wide dialog on desktop, a bottom sheet on a
	     phone. The React original used a right-hand Sheet, which has no
	     frappe-ui equivalent. -->
	<component
		:is="isDesktop ? Dialog : BottomSheet"
		v-bind="isDesktop ? { size: '3xl' } : {}"
		:open="open"
		:title="draftName ? 'Continue Draft' : 'New Assignment'"
		@update:open="emit('update:open', $event)"
	>
		<div :class="isDesktop ? undefined : 'px-4 pb-6'">
			<p class="text-p-base text-ink-gray-5">
				Fill in the details, then switch to Preview to see the student view. Closing keeps
				your work as a draft.
			</p>

			<Tabs
				class="mt-4"
				:model-value="activeTab"
				@update:model-value="activeTab = String($event)"
			>
				<TabList variant="underline">
					<TabTrigger value="edit" label="Edit" icon-left="lucide-pencil" />
					<TabTrigger value="preview" label="Preview" icon-left="lucide-eye" />
				</TabList>

				<TabPanel value="edit" class="space-y-4 pt-5">
					<FormControl
						v-model="draft.title"
						type="text"
						label="Title"
						placeholder="Assignment title"
						required
						:error="errors.title"
					/>

					<FormControl
						v-model="draft.cohort"
						type="select"
						label="Cohort"
						placeholder="Select a cohort"
						:options="cohortOptions"
						:error="errors.cohort"
					/>

					<div class="grid gap-3 sm:grid-cols-2">
						<FormControl
							v-model="draft.submission_type"
							type="select"
							label="Submission Type"
							:options="SUBMISSION_TYPES"
						/>
						<FormControl
							v-model="evaluationType"
							type="select"
							label="Evaluation Type"
							:options="EVALUATION_OPTIONS"
						/>
					</div>

					<FormControl
						v-if="evaluationType === 'Marks'"
						v-model="draft.max_marks"
						type="number"
						label="Max Marks"
						min="0"
					/>

					<DateTimePicker
						label="Due Date"
						placeholder="Pick a date and time"
						:model-value="draft.due_date"
						:error="errors.due_date"
						@update:model-value="draft.due_date = $event ?? ''"
					/>

					<FormControl
						v-model="draft.description"
						type="textarea"
						label="Description"
						description="Markdown supported"
						:rows="6"
						:placeholder="DESCRIPTION_PLACEHOLDER"
					/>

					<div class="space-y-2">
						<PublishFields
							v-model:mode="publishMode"
							v-model:publish-on="publishOn"
							include-draft
							hint="A scheduled assignment appears to students at the chosen time."
						/>
						<ErrorMessage :message="errors.publishOn" />
					</div>

					<ErrorMessage :message="errors.form" />
				</TabPanel>

				<TabPanel value="preview" class="pt-5">
					<AssignmentPreview :draft="draft" />
				</TabPanel>
			</Tabs>

			<div
				class="mt-6 flex items-center justify-between gap-3 border-t border-outline-gray-1 pt-4"
			>
				<Button
					v-if="deletableName"
					variant="subtle"
					theme="red"
					label="Delete"
					@click="confirmDelete = true"
				/>
				<span v-else />
				<Button
					variant="solid"
					theme="gray"
					:label="draftName ? 'Save Assignment' : 'Create Assignment'"
					:loading="createCall.loading || updateCall.loading"
					@click="handleSubmit"
				/>
			</div>
		</div>
	</component>

	<DeleteAssignmentDialog
		v-model:open="confirmDelete"
		:assignment="deletableName ? { name: deletableName, title: draft.title } : null"
		@success="handleDeleted"
	/>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
	BottomSheet,
	Button,
	DateTimePicker,
	Dialog,
	ErrorMessage,
	FormControl,
	TabList,
	TabPanel,
	TabTrigger,
	Tabs,
	toast,
	useCall,
} from 'frappe-ui'
import PublishFields from '@/components/common/PublishFields.vue'
import AssignmentPreview, { type AssignmentDraft } from '@/components/faculty/AssignmentPreview.vue'
import DeleteAssignmentDialog from '@/components/faculty/DeleteAssignmentDialog.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { toFrappeDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage'
import {
	SUBMISSION_TYPES,
	type CS17Assignment,
	type EvaluationType,
	type PublishMode,
} from '@/types'

const props = defineProps<{
	open: boolean
	/** Cohort names for the picker; the page already lists them for its filter. */
	cohorts: string[]
	/** An existing draft to continue. Unset for a brand-new assignment. */
	draftName?: string | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()

const EVALUATION_OPTIONS = ['Grade', 'Marks', 'Non-graded']

const DESCRIPTION_PLACEHOLDER =
	'What should students do?\n\n- Use **markdown**\n- Add lists, links, headings'

/** What the localStorage draft holds — the form, not just the doc fields. */
interface StoredDraft {
	draft: AssignmentDraft
	publish: PublishMode
	publishOn: string
}

function emptyDraft(): AssignmentDraft {
	return {
		title: '',
		cohort: '',
		submission_type: 'Any',
		assignment_type: 'Not Graded',
		max_marks: '',
		remarks: 'Grade',
		due_date: '',
		description: '',
	}
}

const { isDesktop } = useBreakpoint()

const draft = reactive<AssignmentDraft>(emptyDraft())
const publishMode = ref<PublishMode>('draft')
const publishOn = ref('')
const activeTab = ref('edit')
const confirmDelete = ref(false)
/** The assignment behind the form once it exists server-side — update, not create. */
const savedName = ref<string | null>(null)

const errors = reactive<Record<'title' | 'cohort' | 'due_date' | 'publishOn' | 'form', string>>({
	title: '',
	cohort: '',
	due_date: '',
	publishOn: '',
	form: '',
})

const cohortOptions = computed(() =>
	props.cohorts.map((cohort) => ({ label: cohort, value: cohort })),
)

const deletableName = computed(() => savedName.value ?? props.draftName ?? null)

const evaluationType = computed({
	get: () => (draft.assignment_type === 'Graded' ? draft.remarks || 'Grade' : 'Non-graded'),
	set: (value) => {
		// "Non-graded" is the doctype's `Not Graded` with no scale and no
		// max marks; the other two are a Graded assignment plus a scale.
		if (value === 'Non-graded') {
			draft.assignment_type = 'Not Graded'
			draft.remarks = ''
			draft.max_marks = ''
		} else {
			draft.assignment_type = 'Graded'
			draft.remarks = value as EvaluationType
		}
	},
})

const existingCall = useCall<CS17Assignment | null, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.get_assignment',
	method: 'GET',
	immediate: false,
})

const createCall = useCall<string, Record<string, unknown>>({
	url: '/api/v2/method/cs17_portal.api.create_assignment',
	method: 'POST',
	immediate: false,
})

const updateCall = useCall<string, Record<string, unknown>>({
	url: '/api/v2/method/cs17_portal.api.update_assignment',
	method: 'POST',
	immediate: false,
})

watch(() => [props.open, props.draftName], initialize)

// Any edit clears the last verdict — validation and server errors alike —
// so a message never outlives the field it was about.
watch(draft, clearErrors)
watch([publishMode, publishOn], clearErrors)

/**
 * The draft survives a closed dialog and a reload, but only for a new
 * assignment: an existing one already has its own copy on the server, and
 * writing it here would overwrite the unsaved new one.
 */
watch([draft, publishMode, publishOn], () => {
	if (props.draftName) return
	if (isDirty()) {
		writeJSON(STORAGE_KEYS.newAssignmentDraft, {
			draft: { ...draft },
			publish: publishMode.value,
			publishOn: publishOn.value,
		} satisfies StoredDraft)
	} else {
		removeKey(STORAGE_KEYS.newAssignmentDraft)
	}
})

function initialize() {
	if (!props.open) return
	activeTab.value = 'edit'
	clearErrors()

	if (props.draftName) {
		if (savedName.value === props.draftName) return
		loadExisting(props.draftName)
		return
	}

	savedName.value = null
	const stored = readJSON<Partial<StoredDraft>>(STORAGE_KEYS.newAssignmentDraft, {})
	Object.assign(draft, emptyDraft(), stored.draft ?? {})
	publishMode.value = stored.publish ?? 'draft'
	publishOn.value = stored.publishOn ?? ''
}

async function loadExisting(name: string) {
	const existing = await existingCall.submit({ assignment: name })
	if (!existing) return
	Object.assign(draft, {
		title: existing.title ?? '',
		cohort: existing.cohort ?? '',
		submission_type: existing.submission_type ?? 'Any',
		assignment_type: existing.assignment_type ?? 'Not Graded',
		max_marks: existing.max_marks ? String(existing.max_marks) : '',
		remarks: existing.remarks || 'Grade',
		due_date: existing.due_date ?? '',
		description: existing.description ?? '',
	} satisfies AssignmentDraft)
	publishMode.value = 'draft'
	publishOn.value = ''
	savedName.value = name
}

function isDirty(): boolean {
	return Boolean(
		draft.title.trim() ||
			draft.description.trim() ||
			draft.cohort ||
			draft.due_date ||
			publishMode.value !== 'draft' ||
			publishOn.value,
	)
}

function clearErrors() {
	errors.title = ''
	errors.cohort = ''
	errors.due_date = ''
	errors.publishOn = ''
	errors.form = ''
}

/** A draft may be half-finished; publishing is what makes the fields required. */
function validate(): boolean {
	clearErrors()
	if (!draft.title.trim()) errors.title = 'Title is required.'
	if (publishMode.value !== 'draft') {
		if (!draft.cohort) errors.cohort = 'Cohort is required to publish.'
		if (!draft.due_date) errors.due_date = 'Due date is required to publish.'
	}
	if (publishMode.value === 'schedule' && !publishOn.value) {
		errors.publishOn = 'Pick a publish date.'
	}
	return !(errors.title || errors.cohort || errors.due_date || errors.publishOn)
}

function reset() {
	Object.assign(draft, emptyDraft())
	publishMode.value = 'draft'
	publishOn.value = ''
	savedName.value = null
	clearErrors()
}

async function handleSubmit() {
	// The messages live under the fields, so a failed save has to come back to
	// the tab that has them.
	if (!validate()) {
		activeTab.value = 'edit'
		return
	}

	const payload = {
		title: draft.title,
		cohort: draft.cohort,
		due_date: toFrappeDatetime(draft.due_date),
		submission_type: draft.submission_type,
		description: draft.description,
		assignment_type: draft.assignment_type,
		max_marks: Number(draft.max_marks) || 0,
		remarks: draft.remarks,
		publish: publishMode.value,
		publish_on: toFrappeDatetime(publishOn.value),
	}

	const call = savedName.value ? updateCall : createCall
	await call.submit(savedName.value ? { assignment: savedName.value, ...payload } : payload)
	if (call.error) {
		errors.form = frappeErrorMessage(call.error, 'Could not save the assignment.')
		return
	}

	removeKey(STORAGE_KEYS.newAssignmentDraft)
	toast.success(savedName.value ? 'Assignment saved' : 'Assignment created')
	reset()
	emit('update:open', false)
	emit('saved')
}

function handleDeleted() {
	removeKey(STORAGE_KEYS.newAssignmentDraft)
	reset()
	emit('update:open', false)
	emit('saved')
}
</script>
