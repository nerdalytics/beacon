import { renderLlmsFull } from '#lib/llm-docs'
import type { RequestHandler } from './$types'

export const prerender = true

export const GET: RequestHandler = (): Response => {
	return new Response(renderLlmsFull('v3000.0.0'), {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
