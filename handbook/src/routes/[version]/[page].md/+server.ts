import { getValidVersions, readPageMarkdown, slugFromHref } from '$lib/llm-docs'
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
	const body = readPageMarkdown(params.version, params.page)

	return new Response(body, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
		},
	})
}
