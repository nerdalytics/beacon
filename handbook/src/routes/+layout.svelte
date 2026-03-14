<script lang="ts">
	import '../app.css'
	import Sidebar from '$lib/components/Sidebar.svelte'
	import { base } from '$app/paths'

	let { children } = $props()
</script>

<div class="min-h-screen bg-navy text-text font-sans flex flex-col">
	<header class="sticky top-0 z-50 border-b border-navy-border bg-navy/95 backdrop-blur">
		<div class="flex items-center justify-between px-6 h-14">
			<a
				href="{base}/"
				class="flex items-center gap-2 text-lg font-bold text-text hover:text-teal transition-colors"
			>
				Beacon
			</a>
			<div class="flex items-center gap-4 text-sm text-text-muted">
				<span class="px-2 py-0.5 rounded text-xs bg-teal/10 text-teal">v2000</span>
				<a
					href="https://github.com/nerdalytics/beacon"
					class="hover:text-text transition-colors">GitHub</a
				>
				<a
					href="https://www.npmjs.com/package/@nerdalytics/beacon"
					class="hover:text-text transition-colors">npm</a
				>
			</div>
		</div>
	</header>

	<div class="flex flex-1">
		<Sidebar />
		{@render children()}
	</div>
</div>
