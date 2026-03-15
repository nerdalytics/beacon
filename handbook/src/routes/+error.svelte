<script lang="ts">
	import { page } from '$app/state'
	import { base } from '$app/paths'
</script>

<div class="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
	<h1 class="text-6xl font-bold text-teal mb-4">{page.status}</h1>
	<p class="text-xl text-text-muted mb-8">{page.error?.message ?? 'Page not found'}</p>
	<a
		href="{base}/"
		class="px-6 py-3 rounded-lg bg-teal/10 text-teal border border-teal/30 hover:bg-teal/20 transition-colors"
	>
		Back to handbook
	</a>
</div>
