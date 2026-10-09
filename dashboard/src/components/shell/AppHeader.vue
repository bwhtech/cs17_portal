<template>
	<!-- Both shells expose a pinned header target, so this teleports into
	     whichever one is mounted. Below `md` the trail collapses to its last
	     label — a breadcrumb strip has nowhere to go on a phone. -->
	<PageHeaderMobile v-if="!isDesktop" :title="currentLabel">
		<template #prefix>
			<slot name="left-mobile" />
		</template>
		<template #suffix>
			<slot name="actions" />
			<AnnouncementsBell />
		</template>
	</PageHeaderMobile>

	<PageHeader v-else>
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<slot name="left">
				<Breadcrumbs :items="trail" />
			</slot>
		</div>

		<div class="flex shrink-0 items-center gap-2">
			<slot name="actions" />
			<AnnouncementsBell />
		</div>
	</PageHeader>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Breadcrumbs, PageHeader, PageHeaderMobile, usePageMeta } from 'frappe-ui'
import AnnouncementsBell from '@/components/announcements/AnnouncementsBell.vue'
import { breadcrumbItems } from '@/composables/useBreadcrumbs'
import { useBreakpoint } from '@/composables/useBreakpoint'

const props = defineProps<{
	/**
	 * The current page. A detail page that has a parent to go back to sets a
	 * trail through `useBreadcrumbs()` instead and leaves this unset.
	 */
	title?: string
}>()

defineSlots<{
	/** Replaces the breadcrumb region on desktop — a back button, an editor. */
	left?: () => unknown
	/** The mobile header's leading zone, usually a `PageHeaderBackButton`. */
	'left-mobile'?: () => unknown
	/** Page actions, at the trailing end of the header. */
	actions?: () => unknown
}>()

const { isDesktop } = useBreakpoint()

/**
 * A top level page shows only its own name; a detail page shows the trail it
 * pushed, parent first. There is no root crumb: the sidebar is already the
 * way home, and a "Workspace" link that opens the Dashboard names a page
 * that does not exist.
 */
const trail = computed(() => {
	if (breadcrumbItems.value.length) return breadcrumbItems.value
	return props.title ? [{ label: props.title }] : []
})

const currentLabel = computed(() => trail.value.at(-1)?.label ?? '')

usePageMeta(() => ({
	title: currentLabel.value ? `${currentLabel.value} | CS17 Portal` : 'CS17 Portal',
}))
</script>
