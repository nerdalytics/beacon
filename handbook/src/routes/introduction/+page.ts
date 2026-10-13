import { redirect } from '@sveltejs/kit'
import { resolveHref } from '#lib/resolve-href.ts'
import { currentVersion } from '#lib/versions.ts'

export function load(): never {
	redirect(307, resolveHref(`${currentVersion.prefix}/introduction`))
}
