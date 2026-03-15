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

<div class="flex-1 flex flex-col items-center justify-center text-center px-4 py-10 lg:py-20 min-h-0 lg:min-h-[80vh] page-enter">
	<img src="{base}/favicon.svg" alt="Beacon logo" class="w-28 h-28 mb-3" style="view-transition-name: beacon-logo" />
	<div class="mb-3 text-7xl font-extrabold beacon-gradient-text">
		Beacon
	</div>

	<div class="mb-3 flex items-center gap-3 flex-wrap justify-center">
		<a href="https://github.com/nerdalytics/beacon/blob/trunk/LICENSE">
			<img src="https://flat.badgen.net/static/license/MIT/blue" alt="MIT License" />
		</a>
		<a href="https://www.npmjs.com/package/@nerdalytics/beacon">
			<img src="https://img.shields.io/npm/v/@nerdalytics/beacon.svg" alt="npm version" />
		</a>
		<a href="https://jsr.io/@nerdalytics/beacon">
			<img src="https://jsr.io/badges/@nerdalytics/beacon" alt="JSR" />
		</a>
		<a href="https://socket.dev/npm/package/@nerdalytics/beacon/overview/2000.0.0">
			<img src="https://badge.socket.dev/npm/package/@nerdalytics/beacon/2000.0.0" alt="Socket Badge" />
		</a>
	</div>
	<div class="mb-2 flex items-center gap-1.5 flex-wrap justify-center">
		<a href="https://nodejs.org/">
			<img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
		</a>
		<a href="https://bun.sh/">
			<img src="https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white" alt="Bun" />
		</a>
		<a href="https://deno.com/">
			<img src="https://img.shields.io/badge/Deno-464647?style=flat-square&logo=deno&logoColor=white" alt="Deno" />
		</a>
		<a href="https://typescriptlang.org/">
			<img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
		</a>
		<a href="https://biomejs.dev/">
			<img src="https://img.shields.io/badge/Biome-60a5fa?style=flat-square&logo=biome&logoColor=white" alt="Biome" />
		</a>
	</div>
	<div class="mb-5 flex items-center gap-1.5 flex-wrap justify-center">
		<a href="https://www.npmjs.com/package/@nerdalytics/beacon">
			<img src="https://img.shields.io/badge/npm-CB3837?style=flat-square&logo=npm&logoColor=white" alt="npm" />
		</a>
		<a href="https://yarnpkg.com/">
			<img src="https://img.shields.io/badge/yarn-2C8EBB?style=flat-square&logo=yarn&logoColor=white" alt="yarn" />
		</a>
		<a href="https://pnpm.io/">
			<img src="https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
		</a>
		<a href="https://jsr.io/@nerdalytics/beacon">
			<img src="https://img.shields.io/badge/jsr-F7DF1E?style=flat-square&logo=jsr&logoColor=black" alt="JSR" />
		</a>
		<a href="https://vlt.sh/">
			<img src="https://img.shields.io/badge/vlt-1A1A2E?style=flat-square&logoColor=white" alt="vlt" />
		</a>
	</div>

	<p class="text-lg text-text-muted max-w-lg mb-8 font-serif leading-relaxed">
		Lightweight reactive state for Node.js backends
	</p>

	<div
		class="mb-8 w-full max-w-md text-left rounded-lg border border-navy-border bg-navy-light p-5 text-sm font-mono leading-relaxed"
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
