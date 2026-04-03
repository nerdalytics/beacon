<script lang="ts">
	import { resolve } from '$app/paths'
	import { currentVersion } from '$lib/versions'
</script>

<svelte:head>
	<meta http-equiv="refresh" content="0; url={resolve(currentVersion.prefix)}" />
	<title>Beacon — Lightweight reactive signals for Node.js backends</title>
</svelte:head>

<div class="flex-1 flex items-center justify-center text-center px-4 py-20">
	<p class="text-text-muted">
		Redirecting to <a href={resolve(currentVersion.prefix)} class="text-teal underline">{currentVersion.label}</a>...
	</p>
</div>
