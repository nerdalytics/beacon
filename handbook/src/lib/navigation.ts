import { base } from '$app/paths'

export interface NavItem {
	href: string
	title: string
}

export interface NavGroup {
	items: NavItem[]
	title: string
}

interface NavConfig {
	deriveName?: string
	hasLens?: boolean
	hasSelect?: boolean
	migration?: string
}

const buildNav = (prefix: string, config: NavConfig = {}): NavGroup[] => {
	const { deriveName = 'Derive', hasLens = true, hasSelect = true, migration } = config

	const guides: NavItem[] = [
		{
			href: `${prefix}/state`,
			title: 'State',
		},
		{
			href: `${prefix}/effects`,
			title: 'Effects',
		},
		{
			href: `${prefix}/${deriveName.toLowerCase()}`,
			title: deriveName,
		},
		{
			href: `${prefix}/batch`,
			title: 'Batch',
		},
	]

	if (hasSelect) {
		guides.push({
			href: `${prefix}/select`,
			title: 'Select',
		})
	}

	if (hasLens) {
		guides.push({
			href: `${prefix}/lens`,
			title: 'Lens',
		})
	}

	const groups: NavGroup[] = [
		{
			items: [
				{
					href: `${prefix}/introduction`,
					title: 'Introduction',
				},
				{
					href: `${prefix}/installation`,
					title: 'Installation',
				},
				{
					href: `${prefix}/quick-start`,
					title: 'Quick Start',
				},
			],
			title: 'Getting Started',
		},
		{
			items: guides,
			title: 'Guides',
		},
		{
			items: [
				{
					href: `${prefix}/architecture`,
					title: 'Architecture',
				},
			],
			title: 'Advanced',
		},
	]

	if (migration) {
		groups.push({
			items: [
				{
					href: `${prefix}/migration`,
					title: migration,
				},
			],
			title: 'Migration',
		})
	}

	groups.push({
		items: [
			{
				href: `${prefix}/llms`,
				title: 'LLM Documentation',
			},
			{
				href: `${prefix}/links`,
				title: 'Resources',
			},
		],
		title: 'Links',
	})

	return groups
}

const versionConfigs: [
	string,
	NavConfig,
][] = [
	[
		'/latest',
		{
			migration: 'v1000.3.1 \u2192 v1000.3.2',
		},
	],
	[
		'/v1000.3.2',
		{
			migration: 'v1000.3.1 \u2192 v1000.3.2',
		},
	],
	[
		'/v1000.3.1',
		{
			migration: 'v1000.3.0 \u2192 v1000.3.1',
		},
	],
	[
		'/v1000.3.0',
		{
			migration: 'v1000.2.5 \u2192 v1000.3.0',
		},
	],
	[
		'/v1000.2.5',
		{
			migration: 'v1000.2.4 \u2192 v1000.2.5',
		},
	],
	[
		'/v1000.2.4',
		{
			migration: 'v1000.2.3 \u2192 v1000.2.4',
		},
	],
	[
		'/v1000.2.3',
		{
			migration: 'v1000.2.2 \u2192 v1000.2.3',
		},
	],
	[
		'/v1000.2.2',
		{
			migration: 'v1000.2.1 \u2192 v1000.2.2',
		},
	],
	[
		'/v1000.2.1',
		{
			migration: 'v1000.2.0 \u2192 v1000.2.1',
		},
	],
	[
		'/v1000.2.0',
		{
			migration: 'v1000.1.1 \u2192 v1000.2.0',
		},
	],
	[
		'/v1000.1.1',
		{
			migration: 'v1000.1.0 \u2192 v1000.1.1',
		},
	],
	[
		'/v1000.1.0',
		{
			migration: 'v1000.0.0 \u2192 v1000.1.0',
		},
	],
	[
		'/v1000.0.0',
		{
			hasLens: false,
			migration: 'v1.0.0 \u2192 v1000.0.0',
		},
	],
	[
		'/v1.0.0',
		{
			deriveName: 'Derived',
			hasLens: false,
			hasSelect: false,
		},
	],
]

export const navigation: Record<string, NavGroup[]> = Object.fromEntries(
	versionConfigs.map(([prefix, config]) => [
		prefix,
		buildNav(prefix, config),
	])
)

/** Extract the version prefix from a URL path (e.g., "/beacon/v1.0.0/state" -> "/v1.0.0", "/beacon/latest/state" -> "/latest") */
export function getVersionPrefix(pathname: string): string | undefined {
	const path = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname
	if (path === '/latest' || path.startsWith('/latest/')) return '/latest'
	const match = path.match(/^(\/v[\d.]+)/)
	return match?.[1]
}

/** Get navigation for the current version, derived from URL path */
export function getNavigation(pathname: string): NavGroup[] {
	const prefix = getVersionPrefix(pathname)
	if (prefix && navigation[prefix]) {
		return navigation[prefix]
	}
	return []
}

/** Get all pages for a given version prefix */
export function getAllPages(prefix: string): NavItem[] {
	const groups = navigation[prefix]
	if (!groups) return []
	return groups.flatMap((g) => g.items)
}
