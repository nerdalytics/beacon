import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { error } from '@sveltejs/kit'
import { versions } from '$lib/versions'
import { getAllPages } from '$lib/navigation'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROUTES_DIR = join(__dirname, '..', 'routes')

/** Set of valid version prefixes without leading slash: 'latest', 'v1000.3.1', etc. */
const VALID_VERSIONS = new Set(versions.map((v) => v.prefix.slice(1)))

/** Get set of valid page slugs for a version prefix (without leading slash). */
function getValidPages(version: string): Set<string> {
	const pages = getAllPages(`/${version}`)
	return new Set(pages.map((p) => p.href.split('/').pop()!))
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

/** Return all valid version strings (without leading slash). */
export function getValidVersions(): string[] {
	return [...VALID_VERSIONS]
}
