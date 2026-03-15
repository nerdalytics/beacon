import { redirect } from '@sveltejs/kit'
import { resolve } from '$app/paths'
import { currentVersion } from '$lib/versions'

export function load(): never {
	redirect(307, resolve(`${currentVersion.prefix}/introduction` as '/introduction'))
}
