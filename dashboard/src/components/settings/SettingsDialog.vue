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
			</SettingsNavGroup>
		</SettingsSidebar>
		<SettingsContent>
			<SettingsPanel value="profile">
				<ProfileSettings />
			</SettingsPanel>
			<SettingsPanel value="preferences">
				<PreferencesSettings />
			</SettingsPanel>
		</SettingsContent>
	</SettingsDialog>

	<Dialog v-else v-model:open="isOpen" title="Settings">
		<div class="space-y-11">
			<ProfileSettings />
			<PreferencesSettings />
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
	Avatar,
	Dialog,
	SettingsContent,
	SettingsDialog,
	SettingsNavGroup,
	SettingsNavItem,
	SettingsPanel,
	SettingsSidebar,
} from 'frappe-ui'
import PreferencesSettings from '@/components/settings/PreferencesSettings.vue'
import ProfileSettings from '@/components/settings/ProfileSettings.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useSession } from '@/composables/useSession'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const { profile } = useSession()
const { isOpen } = useSettingsDialog()
const { isDesktop } = useBreakpoint()

const tab = ref<string | number | undefined>('profile')
</script>
