import { defineParams } from '@sveltejs/kit/params'

export const params = defineParams({
	// Page slugs never contain a dot; dotted paths (state.md, llms.txt) fall through to the [version] routes.
	slug: (param: string): string | undefined => (param.includes('.') ? undefined : param),
})
