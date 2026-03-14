import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex, escapeSvelte } from 'mdsvex'
import { createHighlighter } from 'shiki'
import rehypeSlug from 'rehype-slug'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const beaconTheme = JSON.parse(
	readFileSync('./src/lib/shiki-beacon-theme.json', 'utf-8')
)

// Singleton highlighter — created once, reused across all code blocks at build time
const highlighterPromise = createHighlighter({
	themes: [beaconTheme],
	langs: ['javascript', 'typescript', 'bash', 'json', 'svelte', 'html', 'css']
})

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
	extensions: ['.md'],
	layout: join(__dirname, './src/lib/components/DocLayout.svelte'),
	highlight: {
		highlighter: async (code, lang = 'text') => {
			const highlighter = await highlighterPromise
			const html = escapeSvelte(
				highlighter.codeToHtml(code, { lang, theme: 'beacon' })
			)
			return `{@html \`${html}\`}`
		}
	},
	rehypePlugins: [rehypeSlug]
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [vitePreprocess(), mdsvex(mdsvexOptions)],
	kit: {
		adapter: adapter({
			fallback: '404.html'
		}),
		paths: {
			base: process.argv.includes('dev') ? '' : process.env.BASE_PATH
		}
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) => {
			if (filename.includes('node_modules')) return undefined
			if (filename.endsWith('.md')) return { runes: false }
			return { runes: true }
		}
	}
}

export default config
