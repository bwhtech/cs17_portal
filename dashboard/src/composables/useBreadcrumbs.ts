import { onUnmounted, ref, type Ref } from 'vue'

export interface BreadcrumbItem {
	label: string
	/** A router path. Omit for the trailing, current item. */
	route?: string
}

/**
 * The trail `AppHeader` renders after "Workspace". A module singleton, so a
 * detail page deep in the tree can set it without threading props through the
 * shell.
 *
 * Readers import this ref; setters go through `useBreadcrumbs()`, which also
 * clears the trail when the page that set it goes away.
 */
export const breadcrumbItems: Ref<BreadcrumbItem[]> = ref([])

export function useBreadcrumbs(): {
	items: Ref<BreadcrumbItem[]>
	set: (next: BreadcrumbItem[]) => void
} {
	// Every page that wants breadcrumbs sets its own, so a trail left behind
	// by the previous one would only ever be wrong.
	onUnmounted(() => {
		breadcrumbItems.value = []
	})

	return {
		items: breadcrumbItems,
		set: (next: BreadcrumbItem[]) => {
			breadcrumbItems.value = next
		},
	}
}
