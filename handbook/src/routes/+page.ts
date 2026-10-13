import { redirect } from '@sveltejs/kit'
import { resolveHref } from '#lib/resolve-href.ts'

export function load(): never {
	redirect(307, resolveHref('/latest'))
}
