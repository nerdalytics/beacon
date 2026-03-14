import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { escapeSvelte, mdsvex } from 'mdsvex'
import rehypeSlug from 'rehype-slug'
import { createHighlighter } from 'shiki'

const __dirname = dirname(fileURLToPath(import.meta.url))

const beaconTheme = JSON.parse(readFileSync('./src/lib/shiki-beacon-theme.json', 'utf-8'))

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
		beaconTheme,
	],
})

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
	extensions: [
		'.md',
	],
	highlight: {
		highlighter: async (code, lang = 'text') => {
			const highlighter = await highlighterPromise
			const html = escapeSvelte(
				highlighter.codeToHtml(code, {
					lang,
					theme: 'beacon',
				})
			)
			return `{@html \`${html}\`}`
		},
	},
	layout: join(__dirname, './src/lib/components/DocLayout.svelte'),
	rehypePlugins: [
		rehypeSlug,
	],
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: [
		'.svelte',
		'.md',
	],
	kit: {
		adapter: adapter({
			fallback: '404.html',
		}),
		paths: {
			base: process.argv.includes('dev') ? '' : process.env.BASE_PATH,
		},
		prerender: {
			handleHttpError: 'warn',
		},
	},
	preprocess: [
		vitePreprocess(),
		mdsvex(mdsvexOptions),
	],
	vitePlugin: {
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
	},
}

export default config
