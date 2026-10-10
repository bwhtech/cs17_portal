import { onMounted, onUnmounted, watch } from 'vue'
import { parseDatetime } from '@/lib/dates'

/** The interval the React app polled at, kept so behaviour doesn't shift. */
export const DEFAULT_POLL_MS = 45_000

const MAX_TIMEOUT_MS = 2 ** 31 - 1

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

	function schedule(at: string) {
		const delay = Math.max(parseDatetime(at).valueOf() - Date.now(), 0) + 500
		if (Number.isNaN(delay)) return
		timer = setTimeout(
			delay > MAX_TIMEOUT_MS ? () => schedule(at) : reload,
			Math.min(delay, MAX_TIMEOUT_MS),
		)
	}

	// Watched, not read once: the timestamp arrives with the first response and
	// moves on every reload, so scheduling on mount would always find it empty.
	watch(
		nextPublishOn,
		(at) => {
			if (timer) clearTimeout(timer)
			if (at) schedule(at)
		},
		{ immediate: true },
	)

	onUnmounted(() => {
		if (timer) clearTimeout(timer)
	})
}
