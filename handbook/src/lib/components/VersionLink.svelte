<script>
	import { getContext } from 'svelte'
	import { resolveHref } from '$lib/resolve-href'

	const { prefix } = getContext('version')

	let { path, children } = $props()
</script><a href={resolveHref(`${prefix}${path}`)}>{@render children()}</a>