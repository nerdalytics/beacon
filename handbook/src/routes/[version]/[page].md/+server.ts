import { getValidVersions, readPageMarkdown, slugFromHref, validatePage, validateVersion } from '$lib/llm-docs'
import { getAllPages } from '$lib/navigation'
import type { RequestHandler } from './$types'

export const prerender = true

export function entries(): {
	version: string
	page: string
}[] {
	const result: {
		version: string
		page: string
	}[] = []
	for (const version of getValidVersions()) {
		const pages = getAllPages(`/${version}`)
		for (const p of pages) {
			const slug = slugFromHref(p.href)
			result.push({
				page: slug,
				version,
			})
		}
	}
	return result
}

export const GET: RequestHandler = ({
	params,
}: {
	params: {
		version: string
		page: string
	}
}) => {
	const version = validateVersion(params.version)
	const page = validatePage(version, params.page)
	const body = readPageMarkdown(version, page)

	return new Response(body, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
		},
	})
}
