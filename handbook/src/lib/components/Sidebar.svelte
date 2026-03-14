<script lang="ts">
	import { navigation } from '$lib/navigation'
	import NavLink from './NavLink.svelte'
</script>

<nav class="w-56 shrink-0 overflow-y-auto py-6 pr-4">
	{#each navigation as group}
		{#if group.items.length > 0}
			<div class="mb-6">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-3">
					{group.title}
				</h3>
				{#each group.items as item}
					<NavLink href={item.href} title={item.title} />
				{/each}
			</div>
		{/if}
	{/each}
</nav>
