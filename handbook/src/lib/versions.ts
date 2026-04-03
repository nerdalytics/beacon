export interface Version {
	badges: {
		node: string
		npm: string
	}
	current: boolean
	label: string
	prefix: string
}

export const versions: Version[] = [
	{
		badges: {
			node: 'https://img.shields.io/badge/node-%3E%3D20.0.0-339933?style=flat-square&logo=nodedotjs&logoColor=white',
			npm: 'https://img.shields.io/npm/v/@nerdalytics/beacon/1.0.0.svg?style=flat-square',
		},
		current: true,
		label: 'v1.0.0',
		prefix: '/v1.0.0',
	},
]

// biome-ignore lint/style/noNonNullAssertion: versions array is static and always contains a current version
export const currentVersion: Version = versions.find((v) => v.current)!
