import adapter from '@sveltejs/adapter-static'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { escapeSvelte, type MdsvexOptions, mdsvex } from 'mdsvex'
import rehypeSlug from 'rehype-slug'
import { type BundledLanguage, createHighlighter, type ThemeInput } from 'shiki'
import { defineConfig, loadEnv } from 'vite'

import beaconTheme from './src/lib/shiki-beacon-theme.json' with { type: 'json' }

// Singleton highlighter — created once, reused across all code blocks at build time
const highlighterPromise = createHighlighter({
	langs: ['javascript', 'typescript', 'bash', 'json', 'svelte', 'html', 'css'],
	themes: [beaconTheme as ThemeInput],
})

const mdsvexOptions: MdsvexOptions = {
	extensions: ['.md'],
	highlight: {
		highlighter: async (code: string, lang: string | null = 'text') => {
			const highlighter = await highlighterPromise
			const html = escapeSvelte(
				highlighter.codeToHtml(code, {
					lang: (lang ?? 'text') as BundledLanguage,
					theme: 'beacon',
				})
			)
			return `{@html \`${html}\`}`
		},
	},
	layout: new URL('./src/lib/components/DocLayout.svelte', import.meta.url).pathname,
	rehypePlugins: [rehypeSlug],
}

export default defineConfig(({ command, isPreview, mode }) => ({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter({
				fallback: '404.html',
			}),
			dynamicCompileOptions: ({ filename }: { filename: string }) => {
				if (filename.includes('node_modules')) return undefined
				if (filename.endsWith('.md'))
					return {
						runes: false,
					}
				return {
					runes: true,
				}
			},
			extensions: ['.svelte', '.md'],
			paths: {
				base: command === 'serve' && !isPreview ? '' : (loadEnv(mode, '.', '').BASE_PATH as `/${string}` | undefined),
			},
			preprocess: [vitePreprocess(), mdsvex(mdsvexOptions)],
		}),
	],
}))
