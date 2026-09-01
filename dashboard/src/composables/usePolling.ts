import { onMounted, onUnmounted, watch } from 'vue'

/** The interval the React app polled at, kept so behaviour doesn't shift. */
export const DEFAULT_POLL_MS = 45_000

/**
 * Reload a `useCall` / `useList` handle on an interval, so a scheduled publish
 * (an assignment, a grade, an announcement) appears without a manual refresh.
 * Replaces SWR's `refreshInterval`, which `useCall` has no equivalent for.
 *
 * A hidden tab is skipped rather than left to queue up requests, and the first
 * reload after the tab comes back is immediate — otherwise returning to a tab
 * that has been away for an hour still shows an hour-old list for 45 seconds.
 */
export function usePolling(reload: () => unknown, ms: number = DEFAULT_POLL_MS): void {
	let timer: ReturnType<typeof setInterval> | null = null
	let missedWhileHidden = false

	function tick() {
		if (document.hidden) {
			missedWhileHidden = true
			return
		}
		reload()
	}

	function onVisibilityChange() {
		if (document.hidden || !missedWhileHidden) return
		missedWhileHidden = false
		reload()
	}

	onMounted(() => {
		timer = setInterval(tick, ms)
		document.addEventListener('visibilitychange', onVisibilityChange)
	})

	onUnmounted(() => {
		if (timer) clearInterval(timer)
		document.removeEventListener('visibilitychange', onVisibilityChange)
	})
}

/**
 * Reload once, when a known scheduled publish lands.
 *
 * The student endpoints return `next_publish_on` beside their rows; pairing
 * this with `usePolling` means a publish shows up on the second rather than
 * up to 45 seconds late.
 */
export function usePublishTimer(
	nextPublishOn: () => string | null | undefined,
	reload: () => unknown,
): void {
	let timer: ReturnType<typeof setTimeout> | null = null

	// Watched, not read once: the timestamp arrives with the first response and
	// moves on every reload, so scheduling on mount would always find it empty.
	watch(
		nextPublishOn,
		(at) => {
			if (timer) clearTimeout(timer)
			if (!at) return
			// Frappe datetimes are site-local without a zone; the `T` form is
			// what `Date` parses as local time, the closest match available.
			const delay = new Date(at.replace(' ', 'T')).getTime() - Date.now()
			if (Number.isNaN(delay)) return
			// A small margin, so the reload lands after the publish, not with it.
			timer = setTimeout(reload, Math.max(delay, 0) + 500)
		},
		{ immediate: true },
	)

	onUnmounted(() => {
		if (timer) clearTimeout(timer)
	})
}
