import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSession } from '@/composables/useSession'

const routes: RouteRecordRaw[] = [
	// Student
	{ path: '/', name: 'Dashboard', component: () => import('@/pages/DashboardPage.vue') },
	{
		path: '/assignments',
		name: 'Assignments',
		component: () => import('@/pages/AssignmentsPage.vue'),
	},
	{
		path: '/assignments/:assignmentId/submission',
		name: 'AssignmentDetail',
		component: () => import('@/pages/AssignmentDetailPage.vue'),
		props: true,
	},
	{ path: '/projects', name: 'Projects', component: () => import('@/pages/ProjectsPage.vue') },
	{
		path: '/projects/:id/edit',
		name: 'ProjectEditor',
		component: () => import('@/pages/ProjectEditorPage.vue'),
		props: true,
	},
	{
		path: '/announcements',
		name: 'Announcements',
		component: () => import('@/pages/AnnouncementsPage.vue'),
	},

	// Faculty
	{
		path: '/faculty',
		name: 'FacultyDashboard',
		component: () => import('@/pages/FacultyDashboardPage.vue'),
	},
	{
		path: '/faculty/assignments',
		name: 'FacultyAssignments',
		component: () => import('@/pages/FacultyAssignmentsPage.vue'),
	},
	{
		path: '/faculty/assignments/:assignmentId',
		name: 'FacultyAssignmentDetail',
		component: () => import('@/pages/FacultyAssignmentDetailPage.vue'),
		props: true,
	},
	{
		path: '/faculty/announcements',
		name: 'FacultyAnnouncements',
		component: () => import('@/pages/FacultyAnnouncementsPage.vue'),
	},
	{
		path: '/faculty/submissions',
		name: 'FacultySubmissions',
		component: () => import('@/pages/FacultySubmissionsPage.vue'),
	},
	{
		path: '/faculty/submissions/:submissionId',
		name: 'FacultyGrading',
		component: () => import('@/pages/FacultyGradingPage.vue'),
		props: true,
	},
	{
		// Hidden sandbox rendering every shared contract. Not linked from anywhere.
		path: '/dev',
		name: 'Dev',
		component: () => import('@/pages/DevPage.vue'),
	},

	{ path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
	// The app is mounted at /dashboard by `website_route_rules`.
	history: createWebHistory('/dashboard'),
	routes,
	scrollBehavior: () => ({ top: 0 }),
})

/** Whether a path belongs to the faculty tree. */
function isFacultyRoute(path: string): boolean {
	return path === '/faculty' || path.startsWith('/faculty/')
}

/**
 * Auth and role live here rather than in the layouts, so a page never mounts
 * for someone who should not be looking at it. Boot data is on `window`
 * before the app is created, so this needs no request and never waits.
 */
router.beforeEach((to) => {
	const { isGuest, isFaculty } = useSession()

	if (isGuest.value) {
		// The router's base is stripped from `fullPath`, so it goes back on for
		// the redirect Frappe's login will follow.
		const target = `/dashboard${to.fullPath}`
		window.location.href = `/login?redirect-to=${encodeURIComponent(target)}`
		return false
	}

	// The sandbox renders shared components, so it belongs to neither tree.
	if (to.name === 'Dev') return true

	if (isFaculty.value && !isFacultyRoute(to.path)) return '/faculty'
	if (!isFaculty.value && isFacultyRoute(to.path)) return '/'
	return true
})

// A lazy chunk that 404s means the deployed build moved under us. Reload once,
// tracked in sessionStorage so a genuinely broken chunk can't loop.
const RELOAD_KEY = 'cs17-chunk-reload'
router.onError((error) => {
	if (!/dynamically imported module|Importing a module script failed/i.test(String(error))) return
	if (sessionStorage.getItem(RELOAD_KEY)) return
	sessionStorage.setItem(RELOAD_KEY, '1')
	window.location.reload()
})
router.isReady().then(() => sessionStorage.removeItem(RELOAD_KEY))

export default router
