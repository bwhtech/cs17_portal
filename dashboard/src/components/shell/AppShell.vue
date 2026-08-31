<template>
	<!-- Zen mode drops the frame entirely: the Scratch editor and the grading
	     workspace get the whole viewport, and both render their own header. -->
	<div v-if="isZen" class="h-full bg-surface-base">
		<router-view />
	</div>

	<MobileShell v-else-if="!isDesktop">
		<router-view />
		<template #nav>
			<AppMobileNav />
		</template>
	</MobileShell>

	<DesktopShell v-else>
		<template #sidebar>
			<AppSidebar />
		</template>
		<router-view />
	</DesktopShell>
</template>

<script setup lang="ts">
import { DesktopShell, MobileShell, useColorScheme, usePageMeta } from 'frappe-ui'
import AppMobileNav from '@/components/shell/AppMobileNav.vue'
import AppSidebar from '@/components/shell/AppSidebar.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useZenMode } from '@/composables/useZenMode'

// Restores the stored `data-theme`; `index.html` has already painted it.
useColorScheme()
usePageMeta(() => ({ title: 'CS17 Portal' }))

const { isDesktop } = useBreakpoint()
const { isZen } = useZenMode()
</script>
