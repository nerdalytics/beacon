<script lang="ts">
	import { page } from '$app/state'
	import { resolveHref } from '$lib/resolve-href'

	let { href, title, onclick }: { href: string; title: string; onclick?: () => void } = $props()

	let fullHref = $derived(resolveHref(href))
	let active = $derived(page.url.pathname === fullHref)
</script>

<a
	href={fullHref}
	{onclick}
	class="block px-3 py-1.5 text-sm rounded transition-colors {active
		? 'text-teal bg-teal/10 border-l-2 border-teal'
		: 'text-text-muted hover:text-text'}"
>
	{title}
</a>
