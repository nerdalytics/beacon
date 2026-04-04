import { base } from '$app/paths'
import { getValidVersions, slugFromHref, validateVersion } from '$lib/llm-docs'
import { getAllPages } from '$lib/navigation'
import type { RequestHandler } from './$types'

export const prerender = true

export function entries(): {
	version: string
}[] {
	return getValidVersions().map((version) => ({
		version,
	}))
}

export const GET: RequestHandler = ({
	params,
}: {
	params: {
		version: string
	}
}) => {
	const version = validateVersion(params.version)
	const pages = getAllPages(`/${version}`)

	const pageLines = pages
		.map((p) => {
			const slug = slugFromHref(p.href)
			return `- [${p.title}](${base}/${version}/${slug}.md)`
		})
		.join('\n')

	const body = `# Beacon — ${version}

> Reactive dependency graph runtime for Node.js. Dependencies are tracked at the signal level. When state changes, derived values and effects update automatically.

## Pages

${pageLines}

## Full documentation

- [All pages merged](${base}/${version}/llms-full.txt)
`

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
