import { error } from '@sveltejs/kit'
import type { Component } from 'svelte'

export const prerender = true

// /latest serves the current version's pages under its own URL; no copy of the docs.
const pages: Record<
	string,
	() => Promise<{
		default: Component
	}>
> = import.meta.glob<{
	default: Component
}>('../../v3000.0.0/*/+page.md')

const slugOf = (path: string): string => path.split('/').at(-2) ?? ''

export function entries(): {
	page: string
}[] {
	return Object.keys(pages).map(
		(
			path
		): {
			page: string
		} => ({
			page: slugOf(path),
		})
	)
}

export const load = async ({
	params,
}: {
	params: {
		page: string
	}
}): Promise<{
	content: Component
}> => {
	const entry = Object.entries(pages).find(([path]) => slugOf(path) === params.page)
	if (!entry) error(404, 'Not found')
	const mod = await entry[1]()
	return {
		content: mod.default,
	}
}
