<script lang="ts">
	let { data } = $props()
	const Page = $derived(data.content)
</script>

<Page />
