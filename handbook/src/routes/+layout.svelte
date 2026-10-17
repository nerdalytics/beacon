<script lang="ts">
	import '../app.css'
	import Sidebar from '#lib/components/Sidebar.svelte'
	import VersionSelector from '#lib/components/VersionSelector.svelte'
	import { version } from '$app/env'
	import { asset, resolve } from '$app/paths'
	import { page, updated } from '$app/state'
	import { onMount, untrack } from 'svelte'
	import { onNavigate } from '$app/navigation'
	import { resolveHref } from '#lib/resolve-href'
	import { getVersionPrefix } from '#lib/navigation'
	import { currentVersion } from '#lib/versions'

	let { children } = $props()

	let scrollContainer: HTMLElement | undefined = $state()

	// A new build makes `updated.current` true. A stale worker never checks on its own, so ask the browser to fetch the worker script again,
	// then poll until the new worker controls this page. A one-off event missed the switch in testing, so polling is the reliable trigger.
	$effect(() => {
		if (!updated.current || !('serviceWorker' in navigator)) return
		navigator.serviceWorker.getRegistration().then((registration) => registration?.update())
		const timer = setInterval(reloadIfNewWorkerControls, 1000)
		return () => clearInterval(timer)
	})

	// Activation deletes every cache but the active worker's, so one cache left and matching the server means the new worker controls this page.
	async function reloadIfNewWorkerControls() {
		const registration = await navigator.serviceWorker.getRegistration()
		if (!registration) return
		const keys = await caches.keys()
		const { version: serverVersion } = await fetch(new URL('_app/version.json', registration.scope), { cache: 'no-store' }).then((r) => r.json())
		if (keys.length === 1 && keys[0] === `cache-${serverVersion}` && serverVersion !== version) location.reload()
	}

	onMount(() => {
		if (!('serviceWorker' in navigator)) return
		updated.check()
	})

	// Compare against the URL, not resolve(): on the server resolve() returns a relative path, so SSR rendered the sidebar and the client removed it.
	let isRootLanding = $derived(page.route.id === '/')
	let isVersionLanding = $derived.by(() => {
		const prefix = getVersionPrefix(page.url.pathname)
		return prefix !== undefined && page.url.pathname.replace(/\/$/, '').endsWith(prefix)
	})
	let isLanding = $derived(isRootLanding || isVersionLanding)
	let activePrefix = $derived(getVersionPrefix(page.url.pathname))
	let homeHref = $derived(activePrefix ? resolveHref(activePrefix) : resolveHref(currentVersion.prefix))
	let sidebarOpen = $state(false)

	$effect(() => {
		page.url.pathname
		untrack(() => {
			if (sidebarOpen) sidebarOpen = false
			scrollContainer?.scrollTo(0, 0)
		})
	})

	onNavigate((navigation) => {
		if (!document.startViewTransition) return

		// Skip view transition for landing page navigations to avoid layout shift
		const fromPrefix = getVersionPrefix(navigation.from?.url.pathname ?? '')
		const toPrefix = getVersionPrefix(navigation.to?.url.pathname ?? '')
		const fromIsLanding = fromPrefix ? !navigation.from?.url.pathname.replace(resolveHref(fromPrefix), '').replace(/\/$/, '') : true
		const toIsLanding = toPrefix ? !navigation.to?.url.pathname.replace(resolveHref(toPrefix), '').replace(/\/$/, '') : true
		if (fromIsLanding || toIsLanding) return

		return new Promise((r) => {
			document.startViewTransition(async () => {
				r()
				await navigation.complete
			})
		})
	})
</script>

<div class="h-dvh flex flex-col overflow-hidden bg-navy text-text font-sans">
	<header class="shrink-0 z-40 bg-navy/95 backdrop-blur header-gradient-border" style="padding-top: env(safe-area-inset-top);">
		<div class="flex items-center justify-between h-14" style="padding-left: max(1rem, env(safe-area-inset-left)); padding-right: max(1rem, env(safe-area-inset-right));">
			<div class="flex items-center gap-2">
				{#if !isLanding}
					<button
						class="lg:hidden p-1.5 -ml-1 text-text-muted hover:text-text transition-colors"
						onclick={() => (sidebarOpen = !sidebarOpen)}
						aria-label="Toggle navigation"
					>
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>
				{/if}

				<a
					href={homeHref}
					class="flex items-center gap-2 text-lg font-bold text-text hover:text-teal transition-colors"
				>
					{#if !isLanding}
						<img
							src={asset('favicon.svg')}
							alt=""
							class="w-7 h-7"
						/>
					{/if}
					<span class="beacon-gradient-text">Beacon</span>
				</a>
			</div>
			<div class="flex items-center gap-3 lg:gap-4 text-sm text-text-muted">
				<VersionSelector />
				<a
					href="https://github.com/nerdalytics/beacon"
					class="hover:text-text transition-colors">GitHub</a
				>
				<a
					href="https://www.npmjs.com/package/@nerdalytics/beacon"
					class="hover:text-text transition-colors">npm</a
				>
				<a
					href="https://jsr.io/@nerdalytics/beacon"
					class="hover:text-text transition-colors">jsr</a
				>
			</div>
		</div>
	</header>

	<div class="flex-1 min-h-0 overflow-y-auto" style="padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);" bind:this={scrollContainer}>
		<div class="doc-grid mx-auto" class:landing={isLanding}>
			{#if !isLanding}
				<Sidebar open={sidebarOpen} onclose={() => (sidebarOpen = false)} />
			{/if}
			{#key page.url.pathname}
				<div class="contents">
					{@render children()}
				</div>
			{/key}
		</div>
	</div>
</div>
