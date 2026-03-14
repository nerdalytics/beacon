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

<div class="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 min-h-[80vh]">
	<div
		class="mb-8 text-7xl font-extrabold bg-gradient-to-r from-teal to-blue-400 bg-clip-text text-transparent"
	>
		Beacon
	</div>

	<p class="text-xl text-text-muted max-w-lg mb-10">
		Lightweight reactive state for Node.js backends
	</p>

	<div
		class="mb-12 w-full max-w-md text-left rounded-lg border border-navy-border bg-navy-light p-5 text-sm font-mono"
	>
		<div class="text-text-muted mb-1">// reactive in three lines</div>
		<div>
			<span class="text-teal">const</span> app = <span class="text-teal">state</span>({'{'}
			count: 0 {'}'})
		</div>
		<div>
			<span class="text-teal">effect</span>(() =&gt; console.log(app.count))
		</div>
		<div>
			app.count++ <span class="text-text-muted">// logs: 1</span>
		</div>
	</div>

	<a
		href="{base}/introduction"
		class="inline-block px-8 py-3 rounded-lg font-semibold text-navy bg-gradient-to-r from-teal to-blue-400 hover:opacity-90 transition-opacity"
	>
		Get Started
	</a>

	<div class="mt-6 flex items-center gap-6 text-sm text-text-muted">
		<span>Zero dependencies</span>
		<span class="text-navy-border">|</span>
		<span>Proxy-based</span>
		<span class="text-navy-border">|</span>
		<span>~900 lines</span>
	</div>
</div>
