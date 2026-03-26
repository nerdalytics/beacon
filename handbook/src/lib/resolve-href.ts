import { resolve } from '$app/paths'

/** Wraps resolve() to accept dynamic href strings that are known-valid routes at runtime. */
export function resolveHref(href: string): string {
	return (resolve as (route: string) => string)(href)
}
