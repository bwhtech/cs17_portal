<template>
	<SettingsDialog v-if="isDesktop" v-model:open="isOpen" v-model:tab="tab">
		<SettingsSidebar>
			<SettingsNavGroup label="Settings">
				<SettingsNavItem value="profile">
					<template #prefix>
						<Avatar
							class="shrink-0"
							size="xs"
							:image="profile?.profile_picture ?? undefined"
							:label="profile?.full_name ?? ''"
						/>
					</template>
					Profile
				</SettingsNavItem>
				<SettingsNavItem value="preferences">
					<template #prefix>
						<span
							class="lucide-sliders-horizontal size-4 shrink-0 text-ink-gray-6"
							aria-hidden="true"
						/>
					</template>
					Preferences
				</SettingsNavItem>
				<SettingsNavItem v-if="canEditAISettings" value="ai">
					<template #prefix>
						<span
							class="lucide-sparkles size-4 shrink-0 text-ink-gray-6"
							aria-hidden="true"
						/>
					</template>
					AI check
				</SettingsNavItem>
				<SettingsNavItem v-if="canAddStudents" value="students">
					<template #prefix>
						<span
							class="lucide-user-plus size-4 shrink-0 text-ink-gray-6"
							aria-hidden="true"
						/>
					</template>
					Add students
				</SettingsNavItem>
			</SettingsNavGroup>
		</SettingsSidebar>
		<SettingsContent>
			<SettingsPanel value="profile">
				<ProfileSettings />
			</SettingsPanel>
			<SettingsPanel value="preferences">
				<PreferencesSettings />
			</SettingsPanel>
			<SettingsPanel v-if="canEditAISettings" value="ai">
				<AISettings />
			</SettingsPanel>
			<SettingsPanel v-if="canAddStudents" value="students">
				<StudentImport />
			</SettingsPanel>
		</SettingsContent>
	</SettingsDialog>

	<Dialog v-else v-model:open="isOpen" title="Settings">
		<div class="space-y-11">
			<ProfileSettings />
			<PreferencesSettings />
			<AISettings v-if="canEditAISettings" />
			<StudentImport v-if="canAddStudents" />
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Avatar,
	Dialog,
	SettingsContent,
	SettingsDialog,
	SettingsNavGroup,
	SettingsNavItem,
	SettingsPanel,
	SettingsSidebar,
	useCall,
} from 'frappe-ui'
import AISettings from '@/components/settings/AISettings.vue'
import PreferencesSettings from '@/components/settings/PreferencesSettings.vue'
import ProfileSettings from '@/components/settings/ProfileSettings.vue'
import StudentImport from '@/components/settings/StudentImport.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useSession } from '@/composables/useSession'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const { profile, isFaculty } = useSession()
const { isOpen } = useSettingsDialog()
const { isDesktop } = useBreakpoint()

const aiSettingsAccess = useCall<
	{ has_permission: boolean },
	{ doctype: string; docname: string; perm_type: string }
>({
	url: '/api/v2/method/frappe.client.has_permission',
	method: 'GET',
	params: { doctype: 'CS17 AI Settings', docname: 'CS17 AI Settings', perm_type: 'write' },
	immediate: false,
})
const canEditAISettings = computed(() => aiSettingsAccess.data?.has_permission === true)

const studentImportAccess = useCall<
	{ has_permission: boolean },
	{ doctype: string; docname: string; perm_type: string }
>({
	url: '/api/v2/method/frappe.client.has_permission',
	method: 'GET',
	params: { doctype: 'CS17 Profile', docname: '', perm_type: 'create' },
	immediate: false,
})
const canAddStudents = computed(() => studentImportAccess.data?.has_permission === true)

watch(isOpen, (open) => {
	if (!open || !isFaculty.value) return
	if (!aiSettingsAccess.data) aiSettingsAccess.fetch()
	if (!studentImportAccess.data) studentImportAccess.fetch()
})

const tab = ref<string | number | undefined>('profile')
</script>
