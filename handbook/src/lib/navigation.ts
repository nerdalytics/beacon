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
				href: '/introduction',
				title: 'Introduction',
			},
			{
				href: '/installation',
				title: 'Installation',
			},
			{
				href: '/quick-start',
				title: 'Quick Start',
			},
		],
		title: 'Getting Started',
	},
	{
		items: [
			{
				href: '/state',
				title: 'State',
			},
			{
				href: '/effects',
				title: 'Effects',
			},
			{
				href: '/derive',
				title: 'Derive',
			},
			{
				href: '/batch',
				title: 'Batch',
			},
		],
		title: 'Guides',
	},
	{
		items: [
			{
				href: '/hooks-overview',
				title: 'Overview',
			},
			{
				href: '/hooks-api',
				title: 'API Reference',
			},
			{
				href: '/hooks-catalog',
				title: 'Catalog',
			},
		],
		title: 'Hooks',
	},
	{
		items: [
			{
				href: '/architecture',
				title: 'Architecture',
			},
			{
				href: '/debugging',
				title: 'Debugging',
			},
			{
				href: '/performance',
				title: 'Performance',
			},
		],
		title: 'Advanced',
	},
	{
		items: [
			{
				href: '/migration',
				title: 'v1000 \u2192 v2000',
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
				href: '/links',
				title: 'Resources',
			},
		],
		title: 'Links',
	},
]
