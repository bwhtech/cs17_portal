import { ref } from 'vue'

/**
 * Settings is a dialog, not a page, so anything that can reach a nav surface
 * can open it: the sidebar's profile dropdown on desktop, the "You" sheet on
 * mobile. One shared ref rather than a prop chain through both shells.
 */
const isOpen = ref(false)

export function useSettingsDialog(): {
	isOpen: typeof isOpen
	open(): void
} {
	return {
		isOpen,
		open: () => {
			isOpen.value = true
		},
	}
}
