import { createApp } from 'vue'
import { FrappeUI, call, setConfig } from 'frappe-ui'
import App from './App.vue'
import router from './router'
import { refreshSessionFromBoot } from '@/composables/useSession'
import './style.css'

/**
 * In production `frappe-ui/vite`'s jinjaBootData plugin writes every key of
 * `cs17_portal/www/dashboard.py`'s boot dict onto `window`. The dev server
 * serves `index.html` verbatim, so fetch the same dict over the API instead —
 * without it there is no profile, and the router guard would send every dev
 * session to the login page.
 */
async function loadDevBootData() {
	if (!import.meta.env.DEV) return
	try {
		const boot = await call<Record<string, unknown>>(
			'cs17_portal.www.dashboard.get_context_for_dev',
		)
		Object.assign(window, boot)
		refreshSessionFromBoot()
	} catch {
		// Only available while `developer_mode` is on.
	}
}

async function start() {
	await loadDevBootData()
	// Frappe stores datetimes in the site's timezone, not the browser's.
	setConfig('systemTimezone', window.system_timezone ?? null)

	const app = createApp(App)
	app.use(router)
	app.use(FrappeUI)
	app.mount('#app')
}

start()
