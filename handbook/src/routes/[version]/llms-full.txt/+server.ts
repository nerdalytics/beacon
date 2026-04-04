import type { RequestHandler } from './$types'
import { getAllPages } from '$lib/navigation'
import { validateVersion, getValidVersions, readPageMarkdown } from '$lib/llm-docs'

export const prerender = true

export function entries() {
	return getValidVersions().map((version) => ({ version }))
}

export const GET: RequestHandler = ({ params }) => {
	const version = validateVersion(params.version)
	const pages = getAllPages(`/${version}`)

	const body = pages
		.map((p) => {
			const slug = p.href.split('/').pop()!
			return readPageMarkdown(version, slug)
		})
		.join('\n\n')

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	})
}
