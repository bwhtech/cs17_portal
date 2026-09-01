/**
 * Typed `localStorage` access. Every read and write is wrapped: Safari in
 * private mode throws on both, and a corrupt value should degrade to "no
 * preference", never take the page down.
 *
 * The keys the app owns. `theme` belongs to frappe-ui's `useColorScheme`, and
 * `tw:theme` / `tw:addons` to the Scratch iframe — neither goes through here.
 */
export const STORAGE_KEYS = {
	/** Announcement names the user has dismissed. */
	dismissedAlerts: 'dismissed-alerts',
	/** The in-progress new-assignment form, so a reload doesn't lose it. */
	newAssignmentDraft: 'cs17-new-assignment-draft',
} as const

export function readJSON<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key)
		return raw === null ? fallback : (JSON.parse(raw) as T)
	} catch {
		return fallback
	}
}

export function writeJSON(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch {
		// A full or unavailable store costs the convenience, not the page.
	}
}

export function removeKey(key: string): void {
	try {
		localStorage.removeItem(key)
	} catch {
		// As above.
	}
}
