<template>
	<!-- Both shells expose a pinned header target, so this teleports into
	     whichever one is mounted. Below `md` the trail collapses to its last
	     label — a breadcrumb strip has nowhere to go on a phone. -->
	<PageHeaderMobile v-if="!isDesktop" :title="currentLabel">
		<template #left>
			<slot name="left-mobile" />
		</template>
		<template #right>
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
import { Breadcrumbs, PageHeader, PageHeaderMobile } from 'frappe-ui'
import AnnouncementsBell from '@/components/announcements/AnnouncementsBell.vue'
import { breadcrumbItems } from '@/composables/useBreadcrumbs'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useSession } from '@/composables/useSession'

const props = defineProps<{
	/**
	 * The current page, appended to the "Workspace" root. A detail page that
	 * builds a deeper trail sets it through `useBreadcrumbs()` instead and
	 * leaves this unset.
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
const { isFaculty } = useSession()

/**
 * "Workspace" is always the root and always a link home; what follows is
 * either the trail a detail page pushed or, failing that, this page's title.
 */
const trail = computed(() => {
	const root = { label: 'Workspace', route: isFaculty.value ? '/faculty' : '/' }
	if (breadcrumbItems.value.length) return [root, ...breadcrumbItems.value]
	return props.title ? [root, { label: props.title }] : [root]
})

const currentLabel = computed(() => trail.value[trail.value.length - 1].label)
</script>
