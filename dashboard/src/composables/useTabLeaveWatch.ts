import { onBeforeUnmount, onMounted } from 'vue'
import { toast, useCall } from 'frappe-ui'
import { trySubmit } from '@/lib/trySubmit'

export function useTabLeaveWatch(project: () => string, isWatching: () => boolean): void {
	const leave = useCall<null, { project: string }>({
		url: '/api/v2/method/cs17_portal.api.record_tab_leave',
		method: 'POST',
		immediate: false,
	})
	const comeBack = useCall<null, { project: string }>({
		url: '/api/v2/method/cs17_portal.api.record_tab_return',
		method: 'POST',
		immediate: false,
	})
	let recording: Promise<unknown> = Promise.resolve()

	function onVisibilityChange() {
		if (!isWatching()) return
		const call = document.visibilityState === 'hidden' ? leave : comeBack
		recording = recording.then(() => trySubmit(call, { project: project() }))
		if (call === comeBack) toast.warning('You left this tab. Your teacher can see this.')
	}

	onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange))
	onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibilityChange))
}
