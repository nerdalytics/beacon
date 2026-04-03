<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/state'
	import { addCopyButtons } from '$lib/copy-code'
	import { getAllPages, getVersionPrefix } from '$lib/navigation'
	import { resolveHref } from '$lib/resolve-href'
	import TOC from './TOC.svelte'

	let {
		title,
		description,
		children,
	}: {
		title?: string
		description?: string
		children: any
	} = $props()

	let articleEl: HTMLElement | undefined = $state()

	onMount(() => {
		if (articleEl) addCopyButtons(articleEl)
	})

	let versionPrefix = $derived(getVersionPrefix(page.url.pathname) ?? '')
	let allPages = $derived(getAllPages(versionPrefix))
	let currentIndex = $derived(
		allPages.findIndex((item) => resolveHref(item.href) === page.url.pathname)
	)
	let prevPage = $derived(currentIndex > 0 ? allPages[currentIndex - 1] : null)
	let nextPage = $derived(currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null)
</script>

<svelte:head>
	{#if title}
		<title>{title} — Beacon</title>
	{/if}
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>

<div class="contents">
	<article bind:this={articleEl} class="min-w-0 py-8 px-4 lg:px-8 page-enter">
		{#if title}
			<h1 class="text-3xl font-bold text-text mb-2 font-sans">{title}</h1>
		{/if}
		{#if description}
			<p class="text-text-muted mb-8">{description}</p>
		{/if}
		<div class="prose">
			{@render children()}
		</div>

		{#if prevPage || nextPage}
			<nav class="flex justify-between items-center mt-16 pt-6 border-t border-navy-border font-sans text-sm">
				{#if prevPage}
					<a
						href={resolveHref(prevPage.href)}
						class="flex flex-col gap-1 text-text-muted hover:text-teal transition-colors"
					>
						<span class="text-xs uppercase tracking-wider">Previous</span>
						<span class="text-text font-medium">← {prevPage.title}</span>
					</a>
				{:else}
					<div></div>
				{/if}
				{#if nextPage}
					<a
						href={resolveHref(nextPage.href)}
						class="flex flex-col gap-1 items-end text-text-muted hover:text-teal transition-colors"
					>
						<span class="text-xs uppercase tracking-wider">Next</span>
						<span class="text-text font-medium">{nextPage.title} →</span>
					</a>
				{/if}
			</nav>
		{/if}
	</article>
	<TOC />
</div>
