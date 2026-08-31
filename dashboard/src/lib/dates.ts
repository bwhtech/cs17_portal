import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

export { dayjs }

/** "Mar 4" — for dense rows where the year is implied. */
export function formatDate(value?: string | null): string {
	return value ? dayjs(value).format('MMM D') : ''
}

/** "Mar 4, 5:30 PM" — anywhere a time matters (due dates, submitted-at). */
export function formatDateTime(value?: string | null): string {
	return value ? dayjs(value).format('MMM D, h:mm A') : ''
}

/** "Tuesday, 4 March" — the dashboard greeting line. */
export function formatLongDate(value?: string | null): string {
	return dayjs(value ?? undefined).format('dddd, D MMMM')
}

/** True when the datetime is in the past. Used for the overdue treatment. */
export function isPast(value?: string | null): boolean {
	return Boolean(value) && dayjs(value).isBefore(dayjs())
}

/**
 * The two directions of Frappe's Datetime format. `DateTimePicker` and the
 * API both speak "YYYY-MM-DD HH:mm:ss"; anything that needs the `T`-separated
 * form goes through `toDatetimeLocal`. Nothing else should know the format.
 */
export function toFrappeDatetime(value: string): string {
	if (!value) return ''
	// Already a Frappe datetime — only the `T` form needs the seconds appended.
	if (!value.includes('T')) return value.length === 16 ? `${value}:00` : value
	return `${value.replace('T', ' ')}:00`
}

export function toDatetimeLocal(value?: string | null): string {
	return value ? value.replace(' ', 'T').slice(0, 16) : ''
}
