import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		frappeui({
			frontendRoute: '/dashboard',
			frappeProxy: { port: 8080 },
			jinjaBootData: true,
			lucideIcons: true,
			buildConfig: {
				indexHtmlPath: '../cs17_portal/www/dashboard.html',
				outDir: '../cs17_portal/public/dashboard',
				baseUrl: '/assets/cs17_portal/dashboard/',
			},
		}),
		vue(),
		{
			name: 'gzip-pyodide-wasm',
			buildStart() {
				const wasm = readFileSync(path.resolve(__dirname, 'node_modules/pyodide/pyodide.asm.wasm'))
				// Not .gz: Vite's dev server sends .gz files with Content-Encoding, so the browser would unzip it first.
				writeFileSync(
					path.resolve(__dirname, 'src/lib/python/pyodide.asm.wasm.gzip'),
					gzipSync(wasm),
				)
			},
		},
		VitePWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.ts',
			injectRegister: false,
			manifest: false,
			injectManifest: {
				globPatterns: ['**/*.{js,css,svg,woff2}'],
				globIgnores: ['**/Inter-Italic*', '**/pyodide*'],
				modifyURLPrefix: { '': '/assets/cs17_portal/dashboard/' },
				dontCacheBustURLsMatching: /^\/assets\/cs17_portal\/dashboard\/assets\//,
			},
		}),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					'frappe-ui': ['frappe-ui'],
				},
			},
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
