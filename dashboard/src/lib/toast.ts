import { shallowRef } from 'vue'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
	description?: string
	action?: { label: string; onClick: () => void }
	duration?: number
}

export interface Toast extends ToastOptions {
	id: number
	kind: ToastKind
	message: string
	duration: number
}

const DURATION_MS = 4000
const BODY_DURATION_MS = 5000

export const currentToast = shallowRef<Toast | null>(null)

let lastId = 0

function show(kind: ToastKind, message: string, options: ToastOptions = {}) {
	currentToast.value = {
		...options,
		id: ++lastId,
		kind,
		message,
		duration:
			options.duration ?? (options.action || options.description ? BODY_DURATION_MS : DURATION_MS),
	}
}

export const toast = {
	success: (message: string, options?: ToastOptions) => show('success', message, options),
	error: (message: string, options?: ToastOptions) => show('error', message, options),
	info: (message: string, options?: ToastOptions) => show('info', message, options),
	warning: (message: string, options?: ToastOptions) => show('warning', message, options),
}
