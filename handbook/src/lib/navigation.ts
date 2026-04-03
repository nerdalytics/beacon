export interface NavItem {
	href: string
	title: string
}

export interface NavGroup {
	items: NavItem[]
	title: string
}

export const navigation: Record<string, NavGroup[]> = {
	'/v1.0.0': [
		{
			items: [
				{ href: '/v1.0.0/introduction', title: 'Introduction' },
				{ href: '/v1.0.0/installation', title: 'Installation' },
				{ href: '/v1.0.0/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1.0.0/state', title: 'State' },
				{ href: '/v1.0.0/effects', title: 'Effects' },
				{ href: '/v1.0.0/derived', title: 'Derived' },
				{ href: '/v1.0.0/batch', title: 'Batch' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1.0.0/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1.0.0/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
}

/** Extract the version prefix from a URL path (e.g., "/v1.0.0/state" -> "/v1.0.0") */
export function getVersionPrefix(pathname: string): string | undefined {
	const match = pathname.match(/^(\/v[\d.]+)/)
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
