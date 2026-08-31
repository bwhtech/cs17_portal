/**
 * The sidebar and the mobile nav both read this. Student and faculty differ
 * only in their rows, so there is one shell over one config rather than the
 * two near-identical sidebars the React app carried.
 */

export interface NavItem {
	label: string
	icon: string
	/** An in-app route. Mutually exclusive with `href`. */
	to?: string
	/** An external destination, opened in a new tab. */
	href?: string
	/** Match only this exact path, for a section root like `/` or `/faculty`. */
	exact?: boolean
}

export interface NavSection {
	label: string
	items: NavItem[]
}

export interface NavConfig {
	sections: NavSection[]
	/** Rendered below a divider, apart from the sections. */
	announcements: NavItem
	/** The four tabs of the mobile nav; the fifth is the profile sheet. */
	mobile: NavItem[]
}

const CHAT_URL = 'https://portal.cs17.org/raven/CS17'
const INBOX_URL = 'https://inbox.cs17.org'
const COURSES_URL = '/lms/courses'

const student: NavConfig = {
	sections: [
		{
			label: 'Workspace',
			items: [
				{ label: 'Dashboard', icon: 'lucide-layout-dashboard', to: '/', exact: true },
				{ label: 'Assignments', icon: 'lucide-clipboard-list', to: '/assignments' },
				{ label: 'Projects', icon: 'lucide-blocks', to: '/projects' },
			],
		},
		{
			label: 'Learning',
			items: [
				{ label: 'Handbook', icon: 'lucide-book-open', href: '/student-handbook' },
				{ label: 'Courses', icon: 'lucide-graduation-cap', href: COURSES_URL },
			],
		},
		{
			label: 'Account',
			items: [
				{ label: 'Open Chat', icon: 'lucide-message-square', href: CHAT_URL },
				{ label: 'Open Inbox', icon: 'lucide-inbox', href: INBOX_URL },
				{ label: 'Settings', icon: 'lucide-settings', to: '/settings' },
			],
		},
	],
	announcements: { label: 'Announcements', icon: 'lucide-bell', to: '/announcements' },
	mobile: [
		{ label: 'Dashboard', icon: 'lucide-layout-dashboard', to: '/', exact: true },
		{ label: 'Assignments', icon: 'lucide-clipboard-list', to: '/assignments' },
		{ label: 'Projects', icon: 'lucide-blocks', to: '/projects' },
		{ label: 'Alerts', icon: 'lucide-bell', to: '/announcements' },
	],
}

const faculty: NavConfig = {
	sections: [
		{
			label: 'Workspace',
			items: [
				{ label: 'Dashboard', icon: 'lucide-layout-dashboard', to: '/faculty', exact: true },
				{ label: 'Assignments', icon: 'lucide-clipboard-list', to: '/faculty/assignments' },
			],
		},
		{
			label: 'Resources',
			items: [
				{ label: 'Faculty Handbook', icon: 'lucide-book-open', href: '/faculty-handbook' },
				{ label: 'Courses', icon: 'lucide-graduation-cap', href: COURSES_URL },
			],
		},
		{
			label: 'Account',
			items: [
				{ label: 'Open Chat', icon: 'lucide-message-square', href: CHAT_URL },
				{ label: 'Open Inbox', icon: 'lucide-inbox', href: INBOX_URL },
				{ label: 'Settings', icon: 'lucide-settings', to: '/faculty/settings' },
			],
		},
	],
	announcements: { label: 'Announcements', icon: 'lucide-bell', to: '/faculty/announcements' },
	mobile: [
		{ label: 'Dashboard', icon: 'lucide-layout-dashboard', to: '/faculty', exact: true },
		{ label: 'Assignments', icon: 'lucide-clipboard-list', to: '/faculty/assignments' },
		{ label: 'Alerts', icon: 'lucide-bell', to: '/faculty/announcements' },
	],
}

export function navConfig(isFaculty: boolean): NavConfig {
	return isFaculty ? faculty : student
}

/** Whether a nav row should read as the current one. */
export function isNavItemActive(item: NavItem, path: string): boolean {
	if (!item.to) return false
	return item.exact ? path === item.to : path.startsWith(item.to)
}
