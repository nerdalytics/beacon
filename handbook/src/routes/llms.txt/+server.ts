import { base } from '$app/paths'
import { versions } from '$lib/versions'
import type { RequestHandler } from './$types'

export const prerender = true

export const GET: RequestHandler = () => {
	const versionLines = versions.map((v) => `- [${v.label}](${base}/${v.prefix.slice(1)}/llms.txt)`).join('\n')

	const body = `# Beacon

> Reactive state management for JavaScript

## Versions

${versionLines}
`

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
