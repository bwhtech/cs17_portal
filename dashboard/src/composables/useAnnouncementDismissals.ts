import { ref, type Ref } from 'vue'
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage'

/**
 * Dismissed announcements, by name. Local to the browser by design — the
 * backend has no per-user dismissal record, and the React app stored the same
 * list under the same key, so a user's dismissals survive the rewrite.
 */
const dismissed: Ref<Set<string>> = ref(
	new Set(readJSON<string[]>(STORAGE_KEYS.dismissedAlerts, [])),
)

export function useAnnouncementDismissals(): {
	dismissed: Ref<Set<string>>
	isDismissed: (name: string) => boolean
	dismiss: (name: string) => void
} {
	return {
		dismissed,
		isDismissed: (name: string) => dismissed.value.has(name),
		dismiss: (name: string) => {
			// A fresh Set, so every watcher on the ref sees the change.
			dismissed.value = new Set(dismissed.value).add(name)
			writeJSON(STORAGE_KEYS.dismissedAlerts, [...dismissed.value])
		},
	}
}
