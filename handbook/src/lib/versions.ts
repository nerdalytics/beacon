export interface Version {
	label: string
	prefix: string
	current: boolean
}

export const versions: Version[] = [
	{ current: true, label: 'v2000', prefix: '/v2000' },
]

export const currentVersion: Version = versions.find((v) => v.current)!
