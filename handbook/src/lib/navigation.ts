export interface NavItem {
	title: string
	href: string
}

export interface NavGroup {
	title: string
	items: NavItem[]
}

export const navigation: NavGroup[] = [
	{
		title: 'Getting Started',
		items: [
			{ title: 'Introduction', href: '/introduction' },
			{ title: 'Installation', href: '/installation' },
			{ title: 'Quick Start', href: '/quick-start' },
		],
	},
	{
		title: 'Guides',
		items: [
			{ title: 'State', href: '/state' },
			{ title: 'Effects', href: '/effects' },
			{ title: 'Derive', href: '/derive' },
			{ title: 'Batch', href: '/batch' },
		],
	},
	{
		title: 'Hooks',
		items: [
			{ title: 'Overview', href: '/hooks-overview' },
			{ title: 'API Reference', href: '/hooks-api' },
			{ title: 'Catalog', href: '/hooks-catalog' },
		],
	},
	{
		title: 'Advanced',
		items: [
			{ title: 'Architecture', href: '/architecture' },
			{ title: 'Debugging', href: '/debugging' },
			{ title: 'Performance', href: '/performance' },
		],
	},
	{
		title: 'Migration',
		items: [{ title: 'v1000 \u2192 v2000', href: '/migration' }],
	},
	{
		title: 'Recipes',
		items: [],
	},
	{
		title: 'Links',
		items: [{ title: 'Resources', href: '/links' }],
	},
]
