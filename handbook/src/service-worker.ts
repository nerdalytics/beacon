/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope

import { build, files, version } from '$service-worker'

const CACHE = `cache-${version}`
const ASSETS: string[] = [
	...build,
	...files,
]

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
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

	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached

			return fetch(event.request).then((response) => {
				if (response.status === 200) {
					const clone = response.clone()
					caches.open(CACHE).then((cache) => cache.put(event.request, clone))
				}
				return response
			})
		})
	)
})
