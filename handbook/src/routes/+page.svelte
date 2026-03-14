<script lang="ts">
	import { base } from '$app/paths'
</script>

<svelte:head>
	<title>Beacon — Lightweight reactive state for Node.js backends</title>
	<meta
		name="description"
		content="Zero-dependency, proxy-based reactive state management for Node.js backends."
	/>
</svelte:head>

<div class="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 min-h-[80vh] page-enter">
	<img src="{base}/favicon.svg" alt="Beacon logo" class="w-28 h-28 mb-6" style="view-transition-name: beacon-logo" />
	<div class="mb-8 text-7xl font-extrabold beacon-gradient-text">
		Beacon
	</div>

	<p class="text-lg text-text-muted max-w-lg mb-10 font-serif leading-relaxed">
		Lightweight reactive state for Node.js backends
	</p>

	<div
		class="mb-12 w-full max-w-md text-left rounded-lg border border-navy-border bg-navy-light p-5 text-sm font-mono leading-relaxed"
	>
		<div class="text-lime mb-1">// reactive in three lines</div>
		<div>
			<span class="text-teal">const</span> app = <span class="text-blue-mid">state</span>({'{'}
			count: <span class="text-[#e8a46e]">0</span> {'}'})
		</div>
		<div>
			<span class="text-blue-mid">effect</span>(() =&gt; <span class="text-blue-mid">console</span>.<span class="text-blue-mid">log</span>(app.count))
		</div>
		<div>
			app.count++ <span class="text-lime">// logs: 1</span>
		</div>
	</div>

	<a
		href="{base}/v2000/introduction"
		class="inline-block px-8 py-3 rounded-lg font-sans font-semibold text-navy bg-gradient-to-r from-teal to-blue-mid hover:opacity-90 transition-opacity"
	>
		Get Started
	</a>

	<div class="mt-6 flex items-center gap-6 text-sm text-text-muted font-sans">
		<span>Zero dependencies</span>
		<span class="text-navy-border">|</span>
		<span>Proxy-based</span>
	</div>
</div>
