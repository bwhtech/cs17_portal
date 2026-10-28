import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'

declare const self: { __WB_MANIFEST: (string | PrecacheEntry)[]; skipWaiting(): Promise<void> }

precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/^v$/] })
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()
