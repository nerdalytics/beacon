import type { RequestHandler } from './$types'
import { getAllPages } from '$lib/navigation'
import { validateVersion, validatePage, getValidVersions, readPageMarkdown } from '$lib/llm-docs'

export const prerender = true

export function entries() {
	const result: { version: string; page: string }[] = []
	for (const version of getValidVersions()) {
		const pages = getAllPages(`/${version}`)
		for (const p of pages) {
			const slug = p.href.split('/').pop()!
			result.push({ version, page: slug })
		}
	}
	return result
}

export const GET: RequestHandler = ({ params }) => {
	const version = validateVersion(params.version)
	const page = validatePage(version, params.page)
	const body = readPageMarkdown(version, page)

	return new Response(body, {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
	})
}
