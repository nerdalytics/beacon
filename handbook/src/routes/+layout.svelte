<script lang="ts">
	import '../app.css'
	import Sidebar from '$lib/components/Sidebar.svelte'
	import { base } from '$app/paths'
	import { page } from '$app/stores'
	import { onNavigate } from '$app/navigation'

	let { children } = $props()

	let isLanding = $derived($page.url.pathname === `${base}/` || $page.url.pathname === base)
	let sidebarOpen = $state(false)

	// Close sidebar on navigation
	$effect(() => {
		$page.url.pathname
		sidebarOpen = false
	})

	// View Transitions API for logo animation
	onNavigate((navigation) => {
		if (!document.startViewTransition) return
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve()
				await navigation.complete
			})
		})
	})
</script>

<div class="h-screen flex flex-col overflow-hidden bg-navy text-text font-sans">
	<!-- Fixed header -->
	<header class="shrink-0 z-40 border-b border-navy-border bg-navy/95 backdrop-blur">
		<div class="flex items-center justify-between px-4 lg:px-6 h-14">
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
					href="{base}/"
					class="flex items-center gap-2 text-lg font-bold text-text hover:text-teal transition-colors"
				>
					{#if !isLanding}
						<img
							src="{base}/favicon.svg"
							alt=""
							class="w-7 h-7"
							style="view-transition-name: beacon-logo"
						/>
					{/if}
					<span class="beacon-gradient-text">Beacon</span>
				</a>
			</div>
			<div class="flex items-center gap-3 lg:gap-4 text-sm text-text-muted">
				<span class="px-2 py-0.5 rounded text-xs bg-teal/10 text-teal">v2000</span>
				<a
					href="https://github.com/nerdalytics/beacon"
					class="hover:text-text transition-colors">GitHub</a
				>
				<a
					href="https://www.npmjs.com/package/@nerdalytics/beacon"
					class="hidden sm:inline hover:text-text transition-colors">npm</a
				>
			</div>
		</div>
	</header>

	<!-- Content area fills remaining height, scrolls independently -->
	<div class="flex flex-1 min-h-0">
		{#if !isLanding}
			<Sidebar open={sidebarOpen} onclose={() => (sidebarOpen = false)} />
		{/if}
		{#key $page.url.pathname}
			<div class="flex-1 min-w-0 overflow-y-auto page-enter">
				{@render children()}
			</div>
		{/key}
	</div>
</div>
