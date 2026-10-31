<template>
	<PanelLayout title="Preferences">
		<div class="pt-6">
			<SettingsRow title="Dark mode" description="Switch between light and dark theme">
				<Switch v-model="isDark" />
			</SettingsRow>
			<SettingsRow
				v-if="aiModelOptions.length > 1"
				title="AI model"
				description="Used by Check with AI."
			>
				<Select
					class="w-48"
					:model-value="aiModel"
					:options="aiModelOptions"
					@update:model-value="saveAiModel(String($event))"
				/>
			</SettingsRow>
		</div>
	</PanelLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Select, SettingsRow, Switch, toast, useCall, useColorScheme } from 'frappe-ui'
import PanelLayout from '@/components/settings/PanelLayout.vue'
import { useSession } from '@/composables/useSession'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { FacultyAIModel } from '@/types'

const { resolvedColorScheme, setColorScheme } = useColorScheme()
const { isFaculty } = useSession()

const isDark = computed({
	get: () => resolvedColorScheme.value === 'dark',
	set: (next: boolean) => setColorScheme(next ? 'dark' : 'light'),
})

const aiModel = ref('')

const aiModels = useCall<FacultyAIModel>({
	url: '/api/v2/method/cs17_portal.api.get_my_ai_model',
	method: 'GET',
	immediate: isFaculty.value,
	onSuccess: (data) => (aiModel.value = data.model ?? ''),
})

const saveCall = useCall<FacultyAIModel, { model: string }>({
	url: '/api/v2/method/cs17_portal.api.set_my_ai_model',
	method: 'POST',
	immediate: false,
})

const aiModelOptions = computed(() =>
	(aiModels.data?.models ?? []).map((model) => ({
		label: model.slice(model.lastIndexOf('/') + 1),
		value: model,
	})),
)

async function saveAiModel(model: string) {
	const previous = aiModel.value
	aiModel.value = model
	await trySubmit(saveCall, { model })
	if (saveCall.error) {
		aiModel.value = previous
		toast.error(frappeErrorMessage(saveCall.error, 'Could not save the AI model.'))
		return
	}
	toast.success('AI model saved', { id: 'ai-model-saved' })
}
</script>
