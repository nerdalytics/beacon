import { readPageMarkdown, validatePage } from '#lib/llm-docs'
import type { RequestHandler } from './$types'

export const prerender = true

export function entries(): {
	page: string
}[] {
	return [
		'architecture',
		'batch',
		'debugging',
		'derive',
		'effects',
		'hooks-api',
		'hooks-catalog',
		'hooks-overview',
		'installation',
		'introduction',
		'links',
		'llms',
		'migration',
		'performance',
		'quick-start',
		'settle',
		'state',
	].map(
		(
			page
		): {
			page: string
		} => ({
			page,
		})
	)
}

export const GET: RequestHandler = ({
	params,
}: {
	params: {
		page: string
	}
}) => {
	const page = validatePage('v3000.0.0', params.page)
	return new Response(readPageMarkdown('v3000.0.0', page), {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
		},
	})
}
