<template>
	<PanelLayout title="Preferences">
		<div class="pt-6">
			<SettingsRow title="Dark mode" description="Switch between light and dark theme">
				<Switch v-model="isDark" />
			</SettingsRow>
		</div>
	</PanelLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SettingsRow, Switch, useColorScheme } from 'frappe-ui'
import PanelLayout from '@/components/settings/PanelLayout.vue'

const { resolvedColorScheme, setColorScheme } = useColorScheme()

const isDark = computed({
	get: () => resolvedColorScheme.value === 'dark',
	set: (next: boolean) => setColorScheme(next ? 'dark' : 'light'),
})
</script>
