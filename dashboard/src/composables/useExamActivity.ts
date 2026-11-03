import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { toast, useCall } from 'frappe-ui'
import { TAB_LEAVE_TOAST_ID } from '@/composables/useTabLeaveWatch'
import { trySubmit } from '@/lib/trySubmit'

export type ExamEventKind =
	| 'tab_leave'
	| 'window_blur'
	| 'fullscreen_exit'
	| 'paste_blocked'
	| 'paste'
	| 'copy_question'
	| 'split_screen'
	| 'second_screen'

type LeaveKind = 'tab_leave' | 'window_blur'
type EventDetails = { seconds?: number; detail?: string }
export type RecordExamEvent = (kind: ExamEventKind, details?: EventDetails) => void

type ExtendedScreen = Screen & Partial<EventTarget> & { isExtended?: boolean }

const LEAVE_SETTLE_MS = 500
const SPLIT_SCREEN_MS = 5000
const SPLIT_SCREEN_AREA = 0.6

export function useExamEvents(
	exam: () => string,
	assignment: () => string | null,
): RecordExamEvent {
	const call = useCall<
		null,
		{ exam: string; kind: ExamEventKind; assignment?: string } & EventDetails
	>({
		url: '/api/v2/method/cs17_portal.exam_activity.record_exam_event',
		method: 'POST',
		immediate: false,
	})
	let recording: Promise<unknown> = Promise.resolve()

	return (kind, details = {}) => {
		const question = assignment()
		const params = { exam: exam(), kind, ...(question ? { assignment: question } : {}), ...details }
		recording = recording.then(() => trySubmit(call, params))
	}
}

export function useExamLeaveWatch(
	record: RecordExamEvent,
	isWatching: () => boolean,
	countsWindowSwitches: () => boolean,
): void {
	let away: { since: number; kind: LeaveKind | null } | null = null
	let settleTimer: ReturnType<typeof setTimeout> | undefined

	function isAway() {
		return document.visibilityState === 'hidden' || (countsWindowSwitches() && !document.hasFocus())
	}

	function onChange() {
		if (!away && isWatching() && isAway()) {
			away = { since: Date.now(), kind: null }
			settleTimer = setTimeout(settle, LEAVE_SETTLE_MS)
		} else if (away && !isAway()) {
			comeBack(away)
		}
	}

	function settle() {
		if (!away) return
		if (!isAway()) {
			away = null
			return
		}
		away.kind = document.visibilityState === 'hidden' ? 'tab_leave' : 'window_blur'
		record(away.kind)
	}

	function comeBack({ since, kind }: { since: number; kind: LeaveKind | null }) {
		clearTimeout(settleTimer)
		away = null
		if (!kind) return
		record(kind, { seconds: Math.round((Date.now() - since) / 100) / 10 })
		toast.warning('You left the exam. Your teacher can see this.', { id: TAB_LEAVE_TOAST_ID })
	}

	onMounted(() => {
		document.addEventListener('visibilitychange', onChange)
		window.addEventListener('blur', onChange)
		window.addEventListener('focus', onChange)
	})
	onBeforeUnmount(() => {
		clearTimeout(settleTimer)
		document.removeEventListener('visibilitychange', onChange)
		window.removeEventListener('blur', onChange)
		window.removeEventListener('focus', onChange)
	})
}

export function useExamFullscreen(
	record: RecordExamEvent,
	isRequired: () => boolean,
): { isFullscreen: Ref<boolean>; hasLeftFullscreen: Ref<boolean>; enterFullscreen: () => void } {
	const isFullscreen = ref(Boolean(document.fullscreenElement))
	const hasLeftFullscreen = ref(false)

	function onFullscreenChange() {
		const wasFullscreen = isFullscreen.value
		isFullscreen.value = Boolean(document.fullscreenElement)
		if (wasFullscreen && !isFullscreen.value && isRequired()) {
			hasLeftFullscreen.value = true
			record('fullscreen_exit')
		}
	}

	function enterFullscreen() {
		document.documentElement.requestFullscreen().catch(() => {
			toast.error('Could not open full screen.')
		})
	}

	onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
	onBeforeUnmount(() => {
		document.removeEventListener('fullscreenchange', onFullscreenChange)
		if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
	})

	return { isFullscreen, hasLeftFullscreen, enterFullscreen }
}

export function useExamScreenWatch(record: RecordExamEvent, isWatching: () => boolean): void {
	const extendedScreen = screen as ExtendedScreen
	let splitTimer: ReturnType<typeof setTimeout> | undefined
	let isSplitRecorded = false
	let isSecondScreenRecorded = false

	function isSplit() {
		const area = window.outerWidth * window.outerHeight
		return area < screen.availWidth * screen.availHeight * SPLIT_SCREEN_AREA
	}

	function checkSplit() {
		if (!isSplit()) {
			clearTimeout(splitTimer)
			splitTimer = undefined
			isSplitRecorded = false
		} else if (!splitTimer && !isSplitRecorded) {
			splitTimer = setTimeout(() => {
				splitTimer = undefined
				if (!isSplit() || !isWatching()) return
				isSplitRecorded = true
				record('split_screen')
			}, SPLIT_SCREEN_MS)
		}
	}

	function checkSecondScreen() {
		if (!extendedScreen.isExtended) isSecondScreenRecorded = false
		else if (!isSecondScreenRecorded && isWatching()) {
			isSecondScreenRecorded = true
			record('second_screen')
		}
	}

	function onScreenChange() {
		checkSplit()
		checkSecondScreen()
	}

	onMounted(() => {
		onScreenChange()
		window.addEventListener('resize', onScreenChange)
		extendedScreen.addEventListener?.('change', onScreenChange)
	})
	onBeforeUnmount(() => {
		clearTimeout(splitTimer)
		window.removeEventListener('resize', onScreenChange)
		extendedScreen.removeEventListener?.('change', onScreenChange)
	})
}
