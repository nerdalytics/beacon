<script lang="ts">
	import { onMount } from 'svelte'
	import { addCopyButtons } from '$lib/copy-code'
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
</script>

<svelte:head>
	{#if title}
		<title>{title} — Beacon</title>
	{/if}
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>

<div class="flex-1 flex min-w-0">
	<article bind:this={articleEl} class="flex-1 min-w-0 py-8 px-8 max-w-3xl">
		{#if title}
			<h1 class="text-3xl font-bold text-text mb-2">{title}</h1>
		{/if}
		{#if description}
			<p class="text-text-muted mb-8">{description}</p>
		{/if}
		<div class="prose">
			{@render children()}
		</div>
	</article>
	<TOC />
</div>
