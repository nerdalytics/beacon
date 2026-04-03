<script lang="ts">
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { versions, currentVersion } from '$lib/versions'
	import { resolveHref } from '$lib/resolve-href'

	function switchVersion(newPrefix: string): void {
		const currentPath = page.url.pathname
		const currentPrefix = currentVersion.prefix
		const pagePath = currentPath.replace(resolveHref(currentPrefix), '')
		goto(resolveHref(`${newPrefix}${pagePath || '/introduction'}`))
	}
</script>

{#if versions.length > 1}
	<select
		class="bg-navy-light border border-navy-border text-teal text-xs rounded px-2 py-1 font-sans"
		value={currentVersion.prefix}
		onchange={(e) => switchVersion(e.currentTarget.value)}
	>
		{#each versions as v}
			<option value={v.prefix}>{v.label}</option>
		{/each}
	</select>
{:else}
	<span class="px-2 py-0.5 rounded text-xs bg-teal/10 text-teal">{currentVersion.label}</span>
{/if}
