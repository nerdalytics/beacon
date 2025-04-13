import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Run tests on compiled JS files for Node.js LTS
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')
const distTestDir = join(distDir, 'tests')

/**
 * Fix imports in compiled test files
 */
function prepareCompiledTests() {
	console.debug('Preparing compiled test files for LTS...')

	// Check if dist/tests directory exists
	if (!existsSync(distTestDir)) {
		console.error(`Error: Directory ${distTestDir} not found.`)
		console.error('Make sure TypeScript compilation completed successfully.')
		process.exit(1)
	}

	// Get all compiled test files
	const testFiles = readdirSync(distTestDir).filter((file) => file.endsWith('.test.js'))

	if (testFiles.length === 0) {
		console.error('No compiled test files found in the dist/tests directory.')
		console.error('Make sure TypeScript compilation completed successfully.')
		process.exit(1)
	}

	console.debug(`Found ${testFiles.length} compiled test files`)

	// Process each test file to fix imports
	for (const file of testFiles) {
		const filePath = join(distTestDir, file)

		// Read the file
		let content = readFileSync(filePath, 'utf8')

		// Fix imports - replace .ts extension with .js
		const originalContent = content
		content = content.replace(/from ['"]([^'"]+)\.ts['"]\s*;?/g, 'from "$1.js";')

		// Only write if the content changed
		if (content !== originalContent) {
			writeFileSync(filePath, content)
			console.debug(`Fixed imports in ${file}`)
		} else {
			console.debug(`No imports to fix in ${file}`)
		}
	}

	console.debug('All compiled test files prepared successfully')
}

prepareCompiledTests()
