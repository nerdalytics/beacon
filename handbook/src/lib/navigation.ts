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
		items: [
			{
				href: '/v2000/introduction',
				title: 'Introduction',
			},
			{
				href: '/v2000/installation',
				title: 'Installation',
			},
			{
				href: '/v2000/quick-start',
				title: 'Quick Start',
			},
		],
		title: 'Getting Started',
	},
	{
		items: [
			{
				href: '/v2000/state',
				title: 'State',
			},
			{
				href: '/v2000/effects',
				title: 'Effects',
			},
			{
				href: '/v2000/derive',
				title: 'Derive',
			},
			{
				href: '/v2000/batch',
				title: 'Batch',
			},
		],
		title: 'Guides',
	},
	{
		items: [
			{
				href: '/v2000/hooks-overview',
				title: 'Overview',
			},
			{
				href: '/v2000/hooks-api',
				title: 'API Reference',
			},
			{
				href: '/v2000/hooks-catalog',
				title: 'Catalog',
			},
		],
		title: 'Hooks',
	},
	{
		items: [
			{
				href: '/v2000/architecture',
				title: 'Architecture',
			},
			{
				href: '/v2000/debugging',
				title: 'Debugging',
			},
			{
				href: '/v2000/performance',
				title: 'Performance',
			},
		],
		title: 'Advanced',
	},
	{
		items: [
			{
				href: '/v2000/migration',
				title: 'v1000 → v2000',
			},
		],
		title: 'Migration',
	},
	{
		items: [],
		title: 'Recipes',
	},
	{
		items: [
			{
				href: '/v2000/links',
				title: 'Resources',
			},
		],
		title: 'Links',
	},
]
