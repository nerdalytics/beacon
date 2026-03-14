export interface Version {
	current: boolean
	label: string
	prefix: string
}

export const versions: Version[] = [
	{
		current: true,
		label: 'v2000',
		prefix: '/v2000',
	},
]

// biome-ignore lint/style/noNonNullAssertion: versions array is static and always contains a current version
export const currentVersion: Version = versions.find((v) => v.current)!
