<script lang="ts">
	import { onMount } from 'svelte'

	interface Heading {
		id: string
		text: string
		level: number
	}

	let headings: Heading[] = $state([])
	let activeId: string = $state('')

	onMount(() => {
		const article = document.querySelector('article')
		if (!article) return

		const elements = article.querySelectorAll('h2, h3')
		headings = Array.from(elements).map((el) => ({
			id: el.id,
			text: el.textContent ?? '',
			level: parseInt(el.tagName[1]!),
		}))

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = entry.target.id
					}
				}
			},
			{ rootMargin: '-80px 0px -80% 0px' }
		)

		for (const el of elements) {
			observer.observe(el)
		}

		return () => observer.disconnect()
	})
</script>

{#if headings.length > 0}
	<aside class="hidden md:block overflow-y-auto py-6 pl-4 sticky top-0 self-start max-h-screen toc-scroll">
		<h4 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
			On this page
		</h4>
		<ul class="space-y-1.5">
			{#each headings as heading}
				<li>
					<a
						href="#{heading.id}"
						class="block text-xs leading-relaxed transition-colors {heading.level === 3
							? 'pl-3'
							: ''} {activeId === heading.id
							? 'text-teal'
							: 'text-text-muted hover:text-text'}"
					>
						{heading.text}
					</a>
				</li>
			{/each}
		</ul>
	</aside>
{/if}
