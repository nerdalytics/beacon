import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { error } from '@sveltejs/kit'
import { getAllPages } from '$lib/navigation'
import { versions } from '$lib/versions'

const ROUTES_DIR: string = join(process.cwd(), 'src', 'routes')

/** Set of valid version prefixes without leading slash: 'latest', 'v1000.3.1', etc. */
const VALID_VERSIONS: Set<string> = new Set(versions.map((v) => v.prefix.slice(1)))

/** Extract the last segment of an href path (e.g., '/latest/state' → 'state'). */
export function slugFromHref(href: string): string {
	return href.split('/').at(-1) ?? ''
}

/** Get set of valid page slugs for a version prefix (without leading slash). */
function getValidPages(version: string): Set<string> {
	const pages = getAllPages(`/${version}`)
	return new Set(pages.map((p) => slugFromHref(p.href)))
}

/** Validate version param against allowlist. Throws 404 if invalid. Returns the validated version string. */
export function validateVersion(version: string): string {
	if (!VALID_VERSIONS.has(version)) {
		error(404, 'Not found. See /llms.txt for available versions and pages.')
	}
	return version
}

/** Validate page param against allowlist for a given version. Throws 404 if invalid. Returns the validated page string. */
export function validatePage(version: string, page: string): string {
	const validPages = getValidPages(version)
	if (!validPages.has(page)) {
		error(404, 'Not found. See /llms.txt for available versions and pages.')
	}
	return page
}

/** Read a raw +page.md file for a given version and page slug. */
export function readPageMarkdown(version: string, page: string): string {
	const safeVersion = validateVersion(version)
	const safePage = validatePage(safeVersion, page)
	const filePath = join(ROUTES_DIR, safeVersion, safePage, '+page.md')
	try {
		return readFileSync(filePath, 'utf-8')
	} catch (err: unknown) {
		if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
			error(404, 'Not found. See /llms.txt for available versions and pages.')
		}
		throw err
	}
}

/** Return all valid version strings (without leading slash), in versions.ts declaration order. */
export function getValidVersions(): string[] {
	return versions.map((v) => v.prefix.slice(1))
}
