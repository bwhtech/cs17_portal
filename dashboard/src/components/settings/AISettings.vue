<template>
	<PanelLayout title="AI check">
		<div class="pt-6">
			<div v-if="!saved && !failed" class="cs17-delay-in space-y-6">
				<Skeleton class="h-14 w-full rounded-2" />
				<Skeleton class="h-14 w-full rounded-2" />
			</div>

			<LoadError
				v-else-if="!saved"
				class="!py-0"
				title="Could not load the AI settings"
				:loading="settings.loading"
				@retry="settings.reload()"
			/>

			<div v-else class="space-y-6">
				<p class="text-p-sm text-ink-gray-5">
					Faculty use these models to check Python submissions. The AI only drafts the
					grade; faculty review and save it.
				</p>
				<FormControl
					v-model="model"
					label="Default model"
					description="As provider/model, for example anthropic/claude-sonnet-5-5 or gemini/gemini-3.5-flash."
					:error="modelError"
					@blur="saveModel"
				/>
				<FormControl
					v-model="otherModels"
					type="textarea"
					label="Other models"
					description="One per line, as provider/model. Faculty can pick these instead of the default."
					:rows="3"
					:error="otherModelsError"
					@blur="saveOtherModels"
				/>
				<FormControl
					v-model="apiKey"
					type="password"
					label="API Key"
					:description="
						saved.has_api_key
							? 'A key is stored. Paste a new one to replace it.'
							: 'The key from the model\'s provider.'
					"
					:error="apiKeyError"
					autocomplete="new-password"
					@blur="saveApiKey"
				/>
			</div>
		</div>
	</PanelLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FormControl, Skeleton, toast, useCall } from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import PanelLayout from '@/components/settings/PanelLayout.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { AISettings } from '@/types'

type AISettingsEdit = { model: string; other_models: string; api_key?: string }

const saved = ref<AISettings | null>(null)
const model = ref('')
const otherModels = ref('')
const apiKey = ref('')
const modelError = ref('')
const otherModelsError = ref('')
const apiKeyError = ref('')

const settings = useCall<AISettings>({
	url: '/api/v2/method/cs17_portal.api.get_ai_settings',
	method: 'GET',
	onSuccess: (data) => {
		saved.value = data
		model.value = data.model ?? ''
		otherModels.value = data.other_models ?? ''
	},
})

const failed = useLoadFailed(settings)

const saveCall = useCall<AISettings, AISettingsEdit>({
	url: '/api/v2/method/cs17_portal.api.save_ai_settings',
	method: 'POST',
	immediate: false,
})

let lastSave: Promise<unknown> = Promise.resolve()

function save(edit: Partial<AISettingsEdit>, fallback: string): Promise<string> {
	const failure = lastSave.then(async () => {
		await trySubmit(saveCall, {
			model: saved.value?.model ?? '',
			other_models: saved.value?.other_models ?? '',
			...edit,
		})
		if (saveCall.error || !saveCall.data) return frappeErrorMessage(saveCall.error, fallback)
		saved.value = saveCall.data
		return ''
	})
	lastSave = failure
	return failure
}

async function saveModel() {
	const next = model.value.trim()
	if (next === (saved.value?.model ?? '')) return
	modelError.value = await save({ model: next }, 'Could not save the model.')
	if (!modelError.value) toast.success('Model saved', { id: 'ai-model-saved' })
}

async function saveOtherModels() {
	const next = otherModels.value.trim()
	if (next === (saved.value?.other_models ?? '')) return
	otherModelsError.value = await save({ other_models: next }, 'Could not save the models.')
	if (!otherModelsError.value) toast.success('Models saved', { id: 'ai-models-saved' })
}

async function saveApiKey() {
	const key = apiKey.value.trim()
	if (!key) return
	apiKeyError.value = await save({ api_key: key }, 'Could not save the API key.')
	if (apiKeyError.value) return
	apiKey.value = ''
	toast.success('API key saved', { id: 'ai-key-saved' })
}
</script>
