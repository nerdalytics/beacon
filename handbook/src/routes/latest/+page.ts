import { redirect } from '@sveltejs/kit'

import { resolveHref } from '#lib/resolve-href'

export const prerender = true

export const load = (): never => {
	redirect(308, resolveHref('/v3000.0.0'))
}
