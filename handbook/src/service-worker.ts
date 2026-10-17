/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope

import { version } from '$app/env'
import { assets, immutable, prerendered } from '$app/manifest'

const CACHE = `cache-${version}`
// cache: 'reload' skips the browser's HTTP cache, so precached pages are never stale copies from an earlier deploy.
const PRECACHE = [...immutable, ...assets, ...prerendered].map(
	(f) => new Request(new URL(f.path.replace(/^\//, ''), self.registration.scope).href, { cache: 'reload' })
)

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	)
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) await caches.delete(key)
			}
			await self.clients.claim()
		})
	)
})

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return

	// The version check must always reach the server, or a stale worker would hide a new build.
	if (new URL(event.request.url).pathname.endsWith('/_app/version.json')) {
		event.respondWith(fetch(event.request, { cache: 'no-store' }))
		return
	}

	event.respondWith(cacheFirst(event.request))
})

async function cacheFirst(request: Request): Promise<Response> {
	const cached = await caches.match(request)
	if (cached) return cached

	const response = await fetch(request)
	if (response.status === 200) {
		const cache = await caches.open(CACHE)
		await cache.put(request, response.clone())
	}
	return response
}
