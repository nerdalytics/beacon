import { redirect } from '@sveltejs/kit'
import { resolveHref } from '$lib/resolve-href'
import { currentVersion } from '$lib/versions'

export function load(): never {
	redirect(307, resolveHref(currentVersion.prefix))
}
