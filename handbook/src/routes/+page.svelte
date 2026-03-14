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
	<div class="mb-4 text-7xl font-extrabold beacon-gradient-text">
		Beacon
	</div>

	<div class="mb-6 flex items-center gap-3 flex-wrap justify-center">
		<a href="https://github.com/nerdalytics/beacon/blob/trunk/LICENSE">
			<img src="https://flat.badgen.net/static/license/MIT/blue" alt="MIT License" />
		</a>
		<a href="https://www.npmjs.com/package/@nerdalytics/beacon">
			<img src="https://img.shields.io/npm/v/@nerdalytics/beacon.svg" alt="npm version" />
		</a>
		<a href="https://socket.dev/npm/package/@nerdalytics/beacon/overview/2000.0.0">
			<img src="https://badge.socket.dev/npm/package/@nerdalytics/beacon/2000.0.0" alt="Socket Badge" />
		</a>
	</div>

	<p class="text-lg text-text-muted max-w-lg mb-10 font-serif leading-relaxed">
		Lightweight reactive state for Node.js backends
	</p>

	<div
		class="mb-12 w-full max-w-md text-left rounded-lg border border-navy-border bg-navy-light p-5 text-sm font-mono leading-relaxed"
	>
		<div class="text-lime mb-1">// reactive in three lines</div>
		<div>
			<span class="text-teal">const</span> $app = <span class="text-blue-mid">state</span>({'{'}
			count: <span class="text-[#e8a46e]">0</span> {'}'})
		</div>
		<div>
			<span class="text-blue-mid">effect</span>(() =&gt; <span class="text-blue-mid">console</span>.<span class="text-blue-mid">log</span>($app.count))
		</div>
		<div>
			$app.count++ <span class="text-lime">// logs: 1</span>
		</div>
	</div>

	<a
		href="{base}/v2000/introduction"
		class="inline-block px-8 py-3 rounded-lg font-sans font-semibold text-navy bg-gradient-to-r from-teal to-blue-mid hover:opacity-90 transition-opacity"
	>
		Get Started
	</a>
</div>
