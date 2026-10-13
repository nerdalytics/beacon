import adapter from '@sveltejs/adapter-static'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { escapeSvelte, mdsvex } from 'mdsvex'
import type { MdsvexOptions } from 'mdsvex'
import rehypeSlug from 'rehype-slug'
import { createHighlighter } from 'shiki'
import type { BundledLanguage, ThemeInput } from 'shiki'
import { defineConfig, loadEnv } from 'vite'

import beaconTheme from './src/lib/shiki-beacon-theme.json' with { type: 'json' }

// Singleton highlighter — created once, reused across all code blocks at build time
const highlighterPromise = createHighlighter({
	langs: [
		'javascript',
		'typescript',
		'bash',
		'json',
		'svelte',
		'html',
		'css',
	],
	themes: [
		beaconTheme as ThemeInput,
	],
})

const mdsvexOptions: MdsvexOptions = {
	extensions: [
		'.md',
	],
	highlight: {
		highlighter: async (code, lang = 'text') => {
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
	rehypePlugins: [
		rehypeSlug,
	],
}

export default defineConfig(({ command, mode }) => ({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter({
				fallback: '404.html',
			}),
			dynamicCompileOptions: ({ filename }) => {
				if (filename.includes('node_modules')) return undefined
				if (filename.endsWith('.md'))
					return {
						runes: false,
					}
				return {
					runes: true,
				}
			},
			extensions: [
				'.svelte',
				'.md',
			],
			paths: {
				base: command === 'serve' ? '' : (loadEnv(mode, '.', '').BASE_PATH as `/${string}` | undefined),
			},
			preprocess: [
				vitePreprocess(),
				mdsvex(mdsvexOptions),
			],
		}),
	],
}))
