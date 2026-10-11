<template>
	<MobileShell v-if="!desktopShell">
		<div id="cs17-page-mobile" :class="pageHostClass" />
		<template #nav>
			<AppMobileNav v-if="!isZen" />
		</template>
	</MobileShell>

	<DesktopShell v-else>
		<template #sidebar>
			<AppSidebar v-if="!isZen" />
		</template>
		<div id="cs17-page-desktop" :class="pageHostClass" />
	</DesktopShell>

	<Teleport :to="pageHost">
		<router-view />
	</Teleport>

	<!-- Settings is a dialog rather than a page, opened from the sidebar's
	     account dropdown or the mobile "You" sheet. Mounted here, once, so it
	     outlives both the zen flip and the breakpoint swap. -->
	<SettingsDialog />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DesktopShell, MobileShell, useColorScheme, usePageMeta } from 'frappe-ui'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import AppMobileNav from '@/components/shell/AppMobileNav.vue'
import AppSidebar from '@/components/shell/AppSidebar.vue'
import { provideAnnouncements } from '@/composables/useAnnouncements'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useZenMode } from '@/composables/useZenMode'

// Restores the stored `data-theme`; `index.html` has already painted it.
useColorScheme()
usePageMeta(() => ({ title: 'CS17 Portal' }))
provideAnnouncements()

const { isDesktop } = useBreakpoint()
const { isZen } = useZenMode()

const desktopShell = ref(isDesktop.value)
watch([isDesktop, isZen], () => {
	if (!isZen.value) desktopShell.value = isDesktop.value
})

// Each branch owns a distinct id: a shared one would leave the teleport
// holding a target element that the branch swap had already destroyed.
const pageHost = computed(() => (desktopShell.value ? '#cs17-page-desktop' : '#cs17-page-mobile'))
const pageHostClass = computed(() => (isZen.value ? 'fixed inset-0 bg-surface-base' : 'contents'))
</script>
