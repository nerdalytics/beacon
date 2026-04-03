import { base } from '$app/paths'

export interface NavItem {
	href: string
	title: string
}

export interface NavGroup {
	items: NavItem[]
	title: string
}

export const navigation: Record<string, NavGroup[]> = {
	'/v1000.2.5': [
		{
			items: [
				{ href: '/v1000.2.5/introduction', title: 'Introduction' },
				{ href: '/v1000.2.5/installation', title: 'Installation' },
				{ href: '/v1000.2.5/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.2.5/state', title: 'State' },
				{ href: '/v1000.2.5/effects', title: 'Effects' },
				{ href: '/v1000.2.5/derive', title: 'Derive' },
				{ href: '/v1000.2.5/batch', title: 'Batch' },
				{ href: '/v1000.2.5/select', title: 'Select' },
				{ href: '/v1000.2.5/lens', title: 'Lens' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.2.5/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.2.5/migration', title: 'v1000.2.4 → v1000.2.5' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.2.5/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
	'/v1000.2.4': [
		{
			items: [
				{ href: '/v1000.2.4/introduction', title: 'Introduction' },
				{ href: '/v1000.2.4/installation', title: 'Installation' },
				{ href: '/v1000.2.4/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.2.4/state', title: 'State' },
				{ href: '/v1000.2.4/effects', title: 'Effects' },
				{ href: '/v1000.2.4/derive', title: 'Derive' },
				{ href: '/v1000.2.4/batch', title: 'Batch' },
				{ href: '/v1000.2.4/select', title: 'Select' },
				{ href: '/v1000.2.4/lens', title: 'Lens' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.2.4/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.2.4/migration', title: 'v1000.2.3 → v1000.2.4' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.2.4/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
	'/v1000.2.3': [
		{
			items: [
				{ href: '/v1000.2.3/introduction', title: 'Introduction' },
				{ href: '/v1000.2.3/installation', title: 'Installation' },
				{ href: '/v1000.2.3/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.2.3/state', title: 'State' },
				{ href: '/v1000.2.3/effects', title: 'Effects' },
				{ href: '/v1000.2.3/derive', title: 'Derive' },
				{ href: '/v1000.2.3/batch', title: 'Batch' },
				{ href: '/v1000.2.3/select', title: 'Select' },
				{ href: '/v1000.2.3/lens', title: 'Lens' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.2.3/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.2.3/migration', title: 'v1000.2.2 → v1000.2.3' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.2.3/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
	'/v1000.2.2': [
		{
			items: [
				{ href: '/v1000.2.2/introduction', title: 'Introduction' },
				{ href: '/v1000.2.2/installation', title: 'Installation' },
				{ href: '/v1000.2.2/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.2.2/state', title: 'State' },
				{ href: '/v1000.2.2/effects', title: 'Effects' },
				{ href: '/v1000.2.2/derive', title: 'Derive' },
				{ href: '/v1000.2.2/batch', title: 'Batch' },
				{ href: '/v1000.2.2/select', title: 'Select' },
				{ href: '/v1000.2.2/lens', title: 'Lens' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.2.2/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.2.2/migration', title: 'v1000.2.1 → v1000.2.2' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.2.2/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
	'/v1000.2.1': [
		{
			items: [
				{ href: '/v1000.2.1/introduction', title: 'Introduction' },
				{ href: '/v1000.2.1/installation', title: 'Installation' },
				{ href: '/v1000.2.1/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.2.1/state', title: 'State' },
				{ href: '/v1000.2.1/effects', title: 'Effects' },
				{ href: '/v1000.2.1/derive', title: 'Derive' },
				{ href: '/v1000.2.1/batch', title: 'Batch' },
				{ href: '/v1000.2.1/select', title: 'Select' },
				{ href: '/v1000.2.1/lens', title: 'Lens' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.2.1/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.2.1/migration', title: 'v1000.2.0 → v1000.2.1' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.2.1/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
	'/v1000.2.0': [
		{
			items: [
				{ href: '/v1000.2.0/introduction', title: 'Introduction' },
				{ href: '/v1000.2.0/installation', title: 'Installation' },
				{ href: '/v1000.2.0/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.2.0/state', title: 'State' },
				{ href: '/v1000.2.0/effects', title: 'Effects' },
				{ href: '/v1000.2.0/derive', title: 'Derive' },
				{ href: '/v1000.2.0/batch', title: 'Batch' },
				{ href: '/v1000.2.0/select', title: 'Select' },
				{ href: '/v1000.2.0/lens', title: 'Lens' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.2.0/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.2.0/migration', title: 'v1000.1.1 → v1000.2.0' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.2.0/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
	'/v1000.1.1': [
		{
			items: [
				{ href: '/v1000.1.1/introduction', title: 'Introduction' },
				{ href: '/v1000.1.1/installation', title: 'Installation' },
				{ href: '/v1000.1.1/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.1.1/state', title: 'State' },
				{ href: '/v1000.1.1/effects', title: 'Effects' },
				{ href: '/v1000.1.1/derive', title: 'Derive' },
				{ href: '/v1000.1.1/batch', title: 'Batch' },
				{ href: '/v1000.1.1/select', title: 'Select' },
				{ href: '/v1000.1.1/lens', title: 'Lens' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.1.1/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.1.1/migration', title: 'v1000.1.0 → v1000.1.1' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.1.1/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
	'/v1000.1.0': [
		{
			items: [
				{ href: '/v1000.1.0/introduction', title: 'Introduction' },
				{ href: '/v1000.1.0/installation', title: 'Installation' },
				{ href: '/v1000.1.0/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.1.0/state', title: 'State' },
				{ href: '/v1000.1.0/effects', title: 'Effects' },
				{ href: '/v1000.1.0/derive', title: 'Derive' },
				{ href: '/v1000.1.0/batch', title: 'Batch' },
				{ href: '/v1000.1.0/select', title: 'Select' },
				{ href: '/v1000.1.0/lens', title: 'Lens' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.1.0/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.1.0/migration', title: 'v1000.0.0 → v1000.1.0' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.1.0/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
	'/v1000.0.0': [
		{
			items: [
				{ href: '/v1000.0.0/introduction', title: 'Introduction' },
				{ href: '/v1000.0.0/installation', title: 'Installation' },
				{ href: '/v1000.0.0/quick-start', title: 'Quick Start' },
			],
			title: 'Getting Started',
		},
		{
			items: [
				{ href: '/v1000.0.0/state', title: 'State' },
				{ href: '/v1000.0.0/effects', title: 'Effects' },
				{ href: '/v1000.0.0/derive', title: 'Derive' },
				{ href: '/v1000.0.0/batch', title: 'Batch' },
				{ href: '/v1000.0.0/select', title: 'Select' },
			],
			title: 'Guides',
		},
		{
			items: [
				{ href: '/v1000.0.0/architecture', title: 'Architecture' },
			],
			title: 'Advanced',
		},
		{
			items: [
				{ href: '/v1000.0.0/migration', title: 'v1.0.0 → v1000.0.0' },
			],
			title: 'Migration',
		},
		{
			items: [
				{ href: '/v1000.0.0/links', title: 'Resources' },
			],
			title: 'Links',
		},
	],
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

/** Extract the version prefix from a URL path (e.g., "/beacon/v1.0.0/state" -> "/v1.0.0") */
export function getVersionPrefix(pathname: string): string | undefined {
	const path = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname
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
