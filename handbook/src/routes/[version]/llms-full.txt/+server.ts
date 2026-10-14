import { getValidVersions, renderLlmsFull, validateVersion } from '#lib/llm-docs'
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
}: {
	params: {
		version: string
	}
}) => {
	const version = validateVersion(params.version)
	const body = renderLlmsFull(version)

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
