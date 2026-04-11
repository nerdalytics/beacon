import { redirect } from '@sveltejs/kit'
import { resolveHref } from '$lib/resolve-href'

export function load(): never {
	redirect(307, resolveHref('/latest'))
}
