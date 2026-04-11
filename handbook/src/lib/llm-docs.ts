import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { error } from '@sveltejs/kit'
import { getAllPages } from '$lib/navigation'
import { resolveVersionLabel, versions } from '$lib/versions'

const FRONTMATTER_BLANKS_RE = /^(---[\s\S]*?---\n)\n+/
const ROUTES_DIR: string = join(process.cwd(), 'src', 'routes')
const SCRIPT_BLOCK_RE = /<script\b[\s\S]*?<\/script\b[^>]*>\s*/gi
const VERSION_LINK_RE = /<VersionLink\s+path="([^"]*)">([\s\S]*?)<\/VersionLink>/g
const VERSION_TAG_RE = /<Version\s*\/>/g

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

/** Strip Svelte-specific syntax and resolve component tags to plain markdown. */
function stripSvelteArtifacts(markdown: string, versionPrefix: string): string {
	const label = resolveVersionLabel(`/${versionPrefix}`)
	let result = markdown
	let previous: string
	do {
		previous = result
		result = result.replace(SCRIPT_BLOCK_RE, '')
	} while (result !== previous)
	result = result.replace(VERSION_TAG_RE, label).replace(VERSION_LINK_RE, (_match, path: string, text: string) => {
		return `[${text}](/${versionPrefix}${path})`
	})
	result = result.replace(FRONTMATTER_BLANKS_RE, '$1\n')
	return result
}

/** Read a raw +page.md file for a given version and page slug. */
export function readPageMarkdown(version: string, page: string): string {
	const safeVersion = validateVersion(version)
	const safePage = validatePage(safeVersion, page)
	const filePath = join(ROUTES_DIR, safeVersion, safePage, '+page.md')
	try {
		const raw = readFileSync(filePath, 'utf-8')
		return stripSvelteArtifacts(raw, safeVersion)
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
