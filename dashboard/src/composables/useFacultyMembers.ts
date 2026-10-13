import { effectScope, watch } from 'vue'
import { useCall } from 'frappe-ui'
import { useSession } from '@/composables/useSession'
import type { FacultyMember } from '@/types'

function fetchFacultyMembers(cohort?: string) {
	return useCall<FacultyMember[], { cohort?: string }>({
		url: '/api/v2/method/cs17_portal.api.get_faculty_members',
		params: { cohort },
		cacheKey: ['faculty-members', cohort ?? ''],
	})
}

type FacultyMembersCall = ReturnType<typeof fetchFacultyMembers>

const scope = effectScope(true)
const callsByCohort = new Map<string, FacultyMembersCall>()

const { profile } = useSession()
scope.run(() =>
	watch(
		() => [profile.value?.full_name, profile.value?.profile_picture],
		() => callsByCohort.forEach((members) => members.reload()),
	),
)

export function useFacultyMembers(cohort?: string): FacultyMembersCall {
	const key = cohort ?? ''
	const members = callsByCohort.get(key) ?? scope.run(() => fetchFacultyMembers(cohort))
	if (!members) throw new Error('useFacultyMembers() could not start its request')
	callsByCohort.set(key, members)
	return members
}
