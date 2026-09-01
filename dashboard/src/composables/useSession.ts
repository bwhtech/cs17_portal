import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { call } from 'frappe-ui'
import type { CS17Profile } from '@/types'

/**
 * The signed-in user, straight off the boot data — no request.
 *
 * `frappe-ui/vite`'s jinjaBootData plugin writes each key of
 * `cs17_portal/www/dashboard.py`'s boot dict onto `window` before the bundle
 * runs, and `main.ts` fetches the same dict in dev. Both are in place by the
 * time any component or the router guard reads this.
 */
const profile: Ref<CS17Profile | null> = ref(window.profile ?? null)
const user: Ref<string | null> = ref(
	window.current_user && window.current_user !== 'Guest' ? window.current_user : null,
)

const isGuest = computed(() => user.value === null)
const isFaculty = computed(() => profile.value?.profile_type === 'Faculty')
const isStudent = computed(() => profile.value?.profile_type === 'Student')
const cohort = computed(() => profile.value?.cohort ?? null)

async function logout(): Promise<void> {
	try {
		await call('logout')
	} finally {
		window.location.href = '/login'
	}
}

export function useSession(): {
	profile: Ref<CS17Profile | null>
	user: Ref<string | null>
	isGuest: ComputedRef<boolean>
	isFaculty: ComputedRef<boolean>
	isStudent: ComputedRef<boolean>
	cohort: ComputedRef<string | null>
	logout: () => Promise<void>
} {
	return { profile, user, isGuest, isFaculty, isStudent, cohort, logout }
}

/**
 * Re-read the boot data. Only `main.ts` needs this: in dev the boot dict
 * arrives from an API call after this module has already been imported.
 */
export function refreshSessionFromBoot(): void {
	profile.value = window.profile ?? null
	user.value = window.current_user && window.current_user !== 'Guest' ? window.current_user : null
}
