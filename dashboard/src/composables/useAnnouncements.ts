import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'
import { useCall } from 'frappe-ui'
import { useAnnouncementDismissals } from '@/composables/useAnnouncementDismissals'
import { usePolling } from '@/composables/usePolling'
import { useSession } from '@/composables/useSession'
import type { CS17Announcement, StudentAnnouncementsResponse } from '@/types'

interface Announcements {
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

	usePolling(() => (isFaculty.value ? facultyCall.reload() : studentCall.reload()))

	const announcements = computed(() =>
		isFaculty.value
			? (facultyCall.data ?? []).filter((announcement) => announcement.is_published)
			: (studentCall.data?.announcements ?? []),
	)

	provide(announcementsKey, {
		unread: computed(() => announcements.value.filter((a) => !dismissed.value.has(a.name))),
	})
}

export function useAnnouncements(): Announcements {
	const announcements = inject(announcementsKey)
	if (!announcements) throw new Error('useAnnouncements() needs provideAnnouncements() above it')
	return announcements
}
