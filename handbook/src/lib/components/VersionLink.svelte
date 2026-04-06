<script>
	import { getContext } from 'svelte'
	import { resolveHref } from '$lib/resolve-href'

	const { prefix } = getContext('version')

	export let path
</script><a href={resolveHref(`${prefix}${path}`)}><slot /></a>