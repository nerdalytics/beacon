import { getValidVersions, renderLlmsIndex, validateVersion } from '#lib/llm-docs'
import type { RequestHandler } from './$types'

export const prerender = true

export function entries(): {
	version: string
}[] {
	return getValidVersions()
		.filter((version) => version !== 'latest')
		.map((version) => ({
			version,
		}))
}

export const GET: RequestHandler = ({
	params,
	url,
}: {
	params: {
		version: string
	}
	url: URL
}) => {
	const version = validateVersion(params.version)
	const base = url.pathname.slice(0, -`/${version}/llms.txt`.length)
	const body = renderLlmsIndex(version, base)

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
