import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'

export default defineConfig({
	plugins: [
		frappeui({
			frontendRoute: '/dashboard',
			frappeProxy: { port: 8000 },
			jinjaBootData: true,
			lucideIcons: true,
			buildConfig: {
				indexHtmlPath: '../cs17_portal/www/dashboard.html',
				outDir: '../cs17_portal/public/dashboard',
				baseUrl: '/assets/cs17_portal/dashboard/',
			},
		}),
		vue(),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	optimizeDeps: {
		// frappe-ui ships unbuilt source with `~icons/lucide/*` virtual imports
		// that esbuild's prebundler cannot resolve.
		exclude: ['frappe-ui'],
		// Transitive CJS deps that still need converting to ESM once frappe-ui
		// itself is excluded from prebundling.
		include: ['tippy.js', 'engine.io-client', 'socket.io-client', 'debug'],
	},
})
