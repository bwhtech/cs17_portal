import { formatDateTime } from '@/lib/dates'

export interface SuddenCode {
	saved_at: string
	after_paste: boolean
	after_tab_leave: boolean
}

export function suddenCodeReason(flag: SuddenCode): string {
	const after = flag.after_paste
		? ', right after a paste'
		: flag.after_tab_leave
			? ', right after leaving the tab'
			: ''
	return `Most of the code arrived in one save at ${formatDateTime(flag.saved_at)}${after}.`
}
