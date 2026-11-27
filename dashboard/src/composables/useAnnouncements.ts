import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'
import { useCall } from 'frappe-ui'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import { usePolling, usePublishTimer } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import { isRefusal } from '@/lib/frappeError'
import type { CS17Announcement, StudentAnnouncementsResponse } from '@/types'

interface Announcements {
	facultyCall: ReturnType<typeof useCall<CS17Announcement[]>>
	studentCall: ReturnType<typeof useCall<StudentAnnouncementsResponse>>
	announcements: ComputedRef<CS17Announcement[]>
	unread: ComputedRef<CS17Announcement[]>
}

const announcementsKey: InjectionKey<Announcements> = Symbol('announcements')

export function provideAnnouncements(): void {
	const { isFaculty, isStudent } = useSession()
	const { dismissed } = useAnnouncementDismissals()

	const facultyCall = useCall<CS17Announcement[]>({
		url: '/api/v2/method/cs17_portal.api.get_faculty_announcements',
		immediate: isFaculty.value,
	})

	const studentCall = useCall<StudentAnnouncementsResponse>({
		url: '/api/v2/method/cs17_portal.api.get_student_announcements',
		immediate: isStudent.value,
	})

	usePolling(() =>
		isFaculty.value ? facultyCall.reload() : isStudent.value && studentCall.reload(),
	)
	usePublishTimer(() => studentCall.data?.next_publish_on, studentCall.reload)

	const announcements = computed<CS17Announcement[]>((previous = []) => {
		const call = isFaculty.value ? facultyCall : studentCall
		if (call.data == null && !isRefusal(call.error)) return previous
		return isFaculty.value
			? (facultyCall.data ?? []).filter((announcement) => announcement.is_published)
			: (studentCall.data?.announcements ?? [])
	})

	provide(announcementsKey, {
		facultyCall,
		studentCall,
		announcements,
		unread: computed(() => announcements.value.filter((a) => !dismissed.value.has(a.name))),
	})
}

export function useAnnouncements(): Announcements {
	const announcements = inject(announcementsKey)
	if (!announcements) throw new Error('useAnnouncements() needs provideAnnouncements() above it')
	return announcements
}
