import { redirect } from '@sveltejs/kit'
import { base } from '$app/paths'
import { currentVersion } from '$lib/versions'

export function load(): never {
	redirect(307, `${base}${currentVersion.prefix}/introduction`)
}
