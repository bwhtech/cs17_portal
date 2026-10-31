import { toast, useCall } from 'frappe-ui'
import { trySubmit } from '@/lib/trySubmit'

const MIN_LINES = 3
const MIN_CHARACTERS = 80

export function usePasteWatch(
	project: () => string,
	isWatching: () => boolean,
): (event: ClipboardEvent) => void {
	const paste = useCall<null, { project: string; text: string }>({
		url: '/api/v2/method/cs17_portal.pastes.record_paste',
		method: 'POST',
		immediate: false,
	})
	let recording: Promise<unknown> = Promise.resolve()

	return (event) => {
		const text = event.clipboardData?.getData('text/plain') ?? ''
		const lines = text.replace(/\r?\n$/, '').split('\n').length
		if (!isWatching() || (lines < MIN_LINES && text.length < MIN_CHARACTERS)) return
		recording = recording.then(() => trySubmit(paste, { project: project(), text }))
		toast.warning('You pasted code. Your teacher can see this.')
	}
}
