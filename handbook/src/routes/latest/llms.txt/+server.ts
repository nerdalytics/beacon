import { renderLlmsIndex } from '#lib/llm-docs'
import type { RequestHandler } from './$types'

export const prerender = true

export const GET: RequestHandler = ({ url }: { url: URL }) => {
	const base = url.pathname.slice(0, -'/latest/llms.txt'.length)
	return new Response(renderLlmsIndex('v3000.0.0', base), {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
