import { computed, inject, provide, ref, type ComputedRef, type InjectionKey } from 'vue'
import { toast, useCall, useList } from 'frappe-ui'
import { usePolling } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import { trySubmit } from '@/lib/trySubmit'
import type { NotificationLog } from '@/types'

interface Notifications {
	unread: ComputedRef<NotificationLog[]>
	markAsRead: (name: string) => Promise<void>
	markAllAsRead: () => Promise<void>
}

const notificationsKey: InjectionKey<Notifications> = Symbol('notifications')

export function provideNotifications(): void {
	const { isStudent } = useSession()

	const notifications = useList<NotificationLog>({
		doctype: 'Notification Log',
		fields: ['name', 'subject', 'document_name', 'creation'],
		filters: { document_type: 'CS17 Assignment', read: 0 },
		orderBy: 'creation desc',
		limit: 20,
		immediate: isStudent.value,
	})

	usePolling(() => isStudent.value && notifications.reload())

	const markOne = useCall<null, { docname: string }>({
		url: '/api/v2/method/frappe.desk.doctype.notification_log.notification_log.mark_as_read',
		method: 'POST',
		immediate: false,
	})

	const markAll = useCall<null, Record<string, never>>({
		url: '/api/v2/method/frappe.desk.doctype.notification_log.notification_log.mark_all_as_read',
		method: 'POST',
		immediate: false,
	})

	const read = ref(new Set<string>())
	const unread = computed(() => (notifications.data ?? []).filter((n) => !read.value.has(n.name)))

	async function markAsRead(name: string) {
		read.value.add(name)
		await trySubmit(markOne, { docname: name })
		if (markOne.error) restore([name])
	}

	async function markAllAsRead() {
		const names = unread.value.map((n) => n.name)
		names.forEach((name) => read.value.add(name))
		await trySubmit(markAll, {})
		if (markAll.error) restore(names)
	}

	function restore(names: string[]) {
		names.forEach((name) => read.value.delete(name))
		toast.error('Could not mark as read.')
	}

	provide(notificationsKey, { unread, markAsRead, markAllAsRead })
}

export function useNotifications(): Notifications {
	const notifications = inject(notificationsKey)
	if (!notifications) throw new Error('useNotifications() needs provideNotifications() above it')
	return notifications
}
