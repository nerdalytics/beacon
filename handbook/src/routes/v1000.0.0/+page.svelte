<script lang="ts">
	import { asset, resolve } from '$app/paths'
</script>

<svelte:head>
	<title>Beacon v1000.0.0 — Lightweight reactive signals for Node.js backends</title>
	<meta
		name="description"
		content="Zero-dependency reactive signal library for Node.js backends. Automatic dependency tracking, select, and efficient updates."
	/>
</svelte:head>

<div class="flex-1 flex flex-col items-center justify-center text-center px-4 py-10 lg:py-20 min-h-0 lg:min-h-[80vh] page-enter">
	<img src={asset('/favicon.svg')} alt="Beacon logo" class="w-28 h-28 mb-3"  />
	<div class="mb-3 text-7xl font-extrabold beacon-gradient-text">
		Beacon
	</div>

	<div class="mb-2 flex items-center gap-1.5 flex-wrap justify-center">
		<a href="https://yarnpkg.com/">
			<img src="https://img.shields.io/badge/yarn-2C8EBB?style=flat-square&logo=yarn&logoColor=white" alt="yarn" />
		</a>
		<a href="https://pnpm.io/">
			<img src="https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
		</a>
		<a href="https://www.npmjs.com/package/@nerdalytics/beacon/v/1000.0.0">
			<img src="https://flat.badgen.net/static/npm/v1000.0.0/blue" alt="npm v1000.0.0" />
		</a>
		<a href="https://socket.dev/npm/package/@nerdalytics/beacon/overview/1000.0.0">
			<img src="https://badge.socket.dev/npm/package/@nerdalytics/beacon/1000.0.0" alt="Socket" />
		</a>
	</div>
	<div class="mb-5 flex items-center gap-1.5 flex-wrap justify-center">
		<a href="https://nodejs.org/">
			<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
		</a>
		<a href="https://typescriptlang.org/">
			<img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
		</a>
		<a href="https://biomejs.dev/">
			<img src="https://img.shields.io/badge/Biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white" alt="Biome" />
		</a>
		<a href="https://github.com/nerdalytics/beacon/blob/trunk/LICENSE">
			<img src="https://img.shields.io/badge/MIT-blue?style=for-the-badge" alt="MIT License" />
		</a>
	</div>

	<p class="text-lg text-text-muted max-w-lg mb-8 font-serif leading-relaxed">
		Lightweight reactive signals for Node.js backends
	</p>

	<div
		class="mb-8 w-full max-w-md text-left rounded-lg border border-navy-border bg-navy-light p-5 text-sm font-mono leading-relaxed"
	>
		<div class="text-lime mb-1">// select a slice, react to it</div>
		<div>
			<span class="text-teal">const</span> $user = <span class="text-blue-mid">state</span>({'{'} name: <span class="text-[#e8a46e]">'Ada'</span>, role: <span class="text-[#e8a46e]">'dev'</span> {'}'})
		</div>
		<div>
			<span class="text-teal">const</span> $name = <span class="text-blue-mid">select</span>($user, (u) =&gt; u.name)
		</div>
		<div>
			<span class="text-blue-mid">effect</span>(() =&gt; <span class="text-blue-mid">console</span>.<span class="text-blue-mid">log</span>($name()))
		</div>
		<div>
			$user.<span class="text-blue-mid">update</span>((u) =&gt; ({'{'} ...u, name: <span class="text-[#e8a46e]">'Grace'</span> {'}'}))
		</div>
	</div>

	<a
		href={resolve('/v1000.0.0/introduction')}
		class="inline-block px-8 py-3 rounded-lg font-sans font-semibold text-navy bg-gradient-to-r from-teal to-blue-mid hover:opacity-90 transition-opacity"
	>
		Get Started
	</a>
</div>
