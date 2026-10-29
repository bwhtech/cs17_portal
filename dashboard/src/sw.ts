import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { pyodideFiles } from './lib/python/pyodide'

declare const self: { __WB_MANIFEST: (string | PrecacheEntry)[]; skipWaiting(): Promise<void> }

const pyodideURLs = new Set(Object.values(pyodideFiles))

precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/^v$/] })
cleanupOutdatedCaches()
registerRoute(
	({ url }) => pyodideURLs.has(url.pathname),
	new CacheFirst({
		cacheName: 'pyodide',
		plugins: [new ExpirationPlugin({ maxEntries: pyodideURLs.size })],
	}),
)
self.skipWaiting()
clientsClaim()
