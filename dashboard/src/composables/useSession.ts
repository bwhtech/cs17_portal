import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import { call, toast, type FrappeResourceError } from 'frappe-ui'
import { clear as clearFrappeUICache, delMany, keys } from 'idb-keyval'
import { STORAGE_KEYS, removeDraftsOfOtherUsers, removeKey } from '@/lib/storage'
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

const logoutGuards = new Set<() => boolean | Promise<boolean>>()

export function onBeforeLogout(guard: () => boolean | Promise<boolean>): void {
	logoutGuards.add(guard)
	onScopeDispose(() => logoutGuards.delete(guard))
}

async function logout(): Promise<void> {
	for (const guard of logoutGuards) if (!(await guard())) return
	try {
		await call('logout')
		removeKey(STORAGE_KEYS.newAssignmentDraft)
		await clearFrappeUICache().catch(() => null)
	} catch (error) {
		if (!(error as FrappeResourceError).response) {
			toast.error('Could not log out.')
			return
		}
	}
	window.location.href = '/login'
}

export async function removeStorageOfOtherUsers(): Promise<void> {
	if (!user.value) return
	removeDraftsOfOtherUsers()
	const ownNamespace = `ns:${encodeURIComponent(user.value)}:`
	const otherUsersCache = (await keys()).filter(
		(key) => typeof key === 'string' && key.startsWith('ns:') && !key.startsWith(ownNamespace),
	)
	await delMany(otherUsersCache)
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
