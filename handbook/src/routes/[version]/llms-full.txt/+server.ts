import { getValidVersions, readPageMarkdown, slugFromHref, validateVersion } from '$lib/llm-docs'
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

	const body = pages
		.map((p) => {
			const slug = slugFromHref(p.href)
			return readPageMarkdown(version, slug)
		})
		.join('\n\n')

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
