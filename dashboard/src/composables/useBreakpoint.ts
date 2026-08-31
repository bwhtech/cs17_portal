import { onScopeDispose, ref, type Ref } from 'vue'

/** Tailwind's `md` — where the desktop shell gives way to the mobile one. */
const DESKTOP_QUERY = '(min-width: 768px)'

const isDesktop: Ref<boolean> = ref(
	typeof window === 'undefined' ? true : window.matchMedia(DESKTOP_QUERY).matches,
)

let media: MediaQueryList | null = null
let listeners = 0

function onChange(event: MediaQueryListEvent) {
	isDesktop.value = event.matches
}

/**
 * Shared desktop/mobile flag. One `matchMedia` listener for the whole app,
 * attached while at least one component is using it.
 */
export function useBreakpoint(): { isDesktop: Ref<boolean> } {
	if (typeof window !== 'undefined') {
		if (!media) media = window.matchMedia(DESKTOP_QUERY)
		if (listeners === 0) media.addEventListener('change', onChange)
		listeners++
		onScopeDispose(() => {
			listeners--
			if (listeners === 0) media?.removeEventListener('change', onChange)
		})
	}
	return { isDesktop }
}
