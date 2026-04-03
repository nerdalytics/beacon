<script lang="ts">
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { versions } from '$lib/versions'
	import { getVersionPrefix } from '$lib/navigation'
	import { resolveHref } from '$lib/resolve-href'

	let activePrefix = $derived(getVersionPrefix(page.url.pathname))
	let activeVersion = $derived(versions.find((v) => v.prefix === activePrefix) ?? versions.find((v) => v.current))

	function switchVersion(newPrefix: string): void {
		const currentPath = page.url.pathname
		if (!activePrefix) {
			goto(resolveHref(`${newPrefix}/introduction`))
			return
		}
		const pagePath = currentPath.replace(resolveHref(activePrefix), '')
		goto(resolveHref(`${newPrefix}${pagePath || '/introduction'}`))
	}
</script>

{#if versions.length > 1}
	<select
		class="bg-navy-light border border-navy-border text-teal text-xs rounded px-2 py-1 font-sans"
		value={activeVersion?.prefix}
		onchange={(e) => switchVersion(e.currentTarget.value)}
	>
		{#each versions as v}
			<option value={v.prefix}>{v.label}</option>
		{/each}
	</select>
{:else if activeVersion}
	<span class="px-2 py-0.5 rounded text-xs bg-teal/10 text-teal">{activeVersion.label}</span>
{/if}
