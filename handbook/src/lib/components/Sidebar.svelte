<script lang="ts">
	import { navigation } from '$lib/navigation'
	import NavLink from './NavLink.svelte'

	let { open = false, onclose }: { open?: boolean; onclose?: () => void } = $props()
</script>

<nav class="hidden lg:block w-56 shrink-0 overflow-y-auto py-6 pr-4">
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

{#if open}
	<div
		class="fixed inset-0 z-50 lg:hidden"
		role="dialog"
		aria-modal="true"
		aria-label="Navigation"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && onclose?.()}
	>
		<button
			class="absolute inset-0 w-full h-full bg-black/60 backdrop-blur-sm cursor-default"
			onclick={onclose}
			aria-label="Close navigation"
			tabindex="-1"
		></button>

		<nav class="absolute left-0 top-0 bottom-0 w-72 bg-navy border-r border-navy-border overflow-y-auto py-6 px-4 sidebar-slide-in">
			{#each navigation as group}
				{#if group.items.length > 0}
					<div class="mb-6">
						<h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-3">
							{group.title}
						</h3>
						{#each group.items as item}
							<NavLink href={item.href} title={item.title} onclick={onclose} />
						{/each}
					</div>
				{/if}
			{/each}
		</nav>
	</div>
{/if}
