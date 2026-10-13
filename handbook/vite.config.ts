import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import adapter from '@sveltejs/adapter-static'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { escapeSvelte, mdsvex } from 'mdsvex'
import rehypeSlug from 'rehype-slug'
import { createHighlighter } from 'shiki'
import { defineConfig } from 'vite'

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

export default defineConfig({
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
				base: process.argv.includes('dev') ? '' : process.env.BASE_PATH,
			},
			preprocess: [
				vitePreprocess(),
				mdsvex(mdsvexOptions),
			],
		}),
	],
})
