<template>
	<!-- Zen mode drops the frame entirely: the Scratch editor and the grading
	     workspace get the whole viewport, and both render their own header. -->
	<div v-if="isZen" class="h-full bg-surface-base">
		<div id="cs17-page-zen" class="contents" />
	</div>

	<MobileShell v-else-if="!isDesktop">
		<div id="cs17-page-mobile" class="contents" />
		<template #nav>
			<AppMobileNav />
		</template>
	</MobileShell>

	<DesktopShell v-else>
		<template #sidebar>
			<AppSidebar />
		</template>
		<div id="cs17-page-desktop" class="contents" />
	</DesktopShell>

	<!-- The routed page is rendered once, here, and teleported into whichever
	     shell is mounted. Putting a `<router-view>` inside each branch instead
	     would unmount the page every time zen flipped — and the Scratch
	     editor's iframe, with the student's unsaved project, along with it.
	     The hosts are `display: contents`, so the page still lays out as a
	     direct child of the shell's scroll region. -->
	<Teleport :to="pageHost">
		<router-view />
	</Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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

// Each branch owns a distinct id: a shared one would leave the teleport
// holding a target element that the branch swap had already destroyed.
const pageHost = computed(() => {
	if (isZen.value) return '#cs17-page-zen'
	return isDesktop.value ? '#cs17-page-desktop' : '#cs17-page-mobile'
})
</script>
