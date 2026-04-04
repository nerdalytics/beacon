import type { RequestHandler } from './$types'
import { base } from '$app/paths'
import { getAllPages } from '$lib/navigation'
import { validateVersion, getValidVersions } from '$lib/llm-docs'

export const prerender = true

export function entries() {
	return getValidVersions().map((version) => ({ version }))
}

export const GET: RequestHandler = ({ params }) => {
	const version = validateVersion(params.version)
	const pages = getAllPages(`/${version}`)

	const pageLines = pages
		.map((p) => {
			const slug = p.href.split('/').pop()!
			return `- [${p.title}](${base}/${version}/${slug}.md)`
		})
		.join('\n')

	const body = `# Beacon — ${version}

> Reactive state management for JavaScript

## Pages

${pageLines}

## Full documentation

- [All pages merged](${base}/${version}/llms-full.txt)
`

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	})
}
