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
import { useRoute } from 'vue-router'
import { Breadcrumbs, PageHeader, PageHeaderMobile, usePageMeta } from 'frappe-ui'
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
const route = useRoute()

/**
 * "Workspace" is the root and a link home; what follows is either the trail a
 * detail page pushed or, failing that, this page's title. Home drops the root:
 * there it would be a link to the page already open.
 */
const trail = computed(() => {
	const home = isFaculty.value ? '/faculty' : '/'
	const page = breadcrumbItems.value.length
		? breadcrumbItems.value
		: props.title
			? [{ label: props.title }]
			: []
	if (route.path === home && page.length) return page
	return [{ label: 'Workspace', route: home }, ...page]
})

const currentLabel = computed(() => trail.value[trail.value.length - 1].label)

usePageMeta(() => ({
	title:
		currentLabel.value === 'Workspace' ? 'CS17 Portal' : `${currentLabel.value} | CS17 Portal`,
}))
</script>
