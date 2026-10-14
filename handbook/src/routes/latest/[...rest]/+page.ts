import { redirect } from '@sveltejs/kit'

import { resolveHref } from '#lib/resolve-href'

export const prerender = true

export function entries(): {
	rest: string
}[] {
	const pages = [
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
	]
	return pages.map(
		(
			rest
		): {
			rest: string
		} => ({
			rest,
		})
	)
}

export const load = ({
	params,
}: {
	params: {
		rest: string
	}
}): never => {
	redirect(308, resolveHref(`/v3000.0.0/${params.rest}`))
}
