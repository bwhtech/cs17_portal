<template>
	<template v-if="isDesktop">
		<SettingsHeader :title="title" />
		<SettingsBody>
			<slot />
		</SettingsBody>
	</template>
	<section v-else>
		<h2 class="text-lg font-semibold text-ink-gray-8">{{ title }}</h2>
		<slot />
	</section>
</template>

<script setup lang="ts">
import { SettingsBody, SettingsHeader } from 'frappe-ui'
import { useBreakpoint } from '@/composables/useBreakpoint'

defineProps<{ title: string }>()

const { isDesktop } = useBreakpoint()
</script>
