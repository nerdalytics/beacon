/**
 * Run tests on compiled JS files for Node.js LTS
 */

import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmdirSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

/**
 * prepare test files for testing with lts version
 */
const testDir = join(rootDir, 'test')
const tempDir = join(rootDir, 'temp')

// Create temp directory if it doesn't exist
if (!existsSync(tempDir)) {
	mkdirSync(tempDir, { recursive: true })
}

console.log('Preparing test files for LTS...')

// Get all test files except template
const testFiles = readdirSync(testDir).filter((file) => file.endsWith('.test.ts') && file !== 'template.test.ts')

console.log(`Found ${testFiles.length} test files`)

// Copy each test file, fixing imports
for (const file of testFiles) {
	const sourceFile = join(testDir, file)
	const destFile = join(tempDir, file)

	// Read the file
	let content = readFileSync(sourceFile, 'utf8')

	// Fix imports - replace ../src/index.ts with ../src/index.js
	content = content.replace(/from ['"]\.\.\/src\/index\.ts['"]/g, 'from "../src/index.js"')
	content = content.replace(/from ['"]\.\.\/src\/(.+?)\.ts['"]/g, 'from "../src/$1.js"')

	// Write the fixed file
	writeFileSync(destFile, content)
	console.log(`Processed ${file}`)
}

console.log('All test files prepared successfully')

/**
 * run prepared test files with lts version
 */
const distDir = join(rootDir, 'dist')
const distTestDir = join(distDir, 'temp')

// Compile the TypeScript files if not already compiled
if (!existsSync(distDir) || !existsSync(distTestDir)) {
	console.log('Compiling TypeScript files...')

	// Create dist directory if needed
	if (!existsSync(distDir)) {
		mkdirSync(distDir, { recursive: true })
	}

	// Run TypeScript compiler
	const tscProcess = spawnSync('tsc', ['-p', 'tsconfig.lts.json'], {
		stdio: 'inherit',
		shell: true,
	})

	if (tscProcess.status !== 0) {
		console.error('TypeScript compilation failed. Check the error above.')
		// rmdirSync(distDir, {recursive:true})
		rmdirSync(tempDir, { recursive: true })
		process.exit(tscProcess.status)
	}
}

// Find all compiled test files
let preparedTestFiles = []
try {
	preparedTestFiles = readdirSync(distTestDir)
		.filter((file) => file.endsWith('.test.js'))
		.map((file) => join(distTestDir, file))
} catch (error) {
	console.error(`Error reading test files: ${error.message}`)
	console.error('Make sure the test files are properly compiled in dist/temp.')
	// rmdirSync(distDir, {recursive:true})
	rmdirSync(tempDir, { recursive: true })
	process.exit(1)
}

if (preparedTestFiles.length === 0) {
	console.error('No compiled test files found. Compilation may have failed.')
	// rmdirSync(distDir, {recursive:true})
	rmdirSync(tempDir, { recursive: true })
	process.exit(1)
}

console.log(`Running ${preparedTestFiles.length} tests for Node.js LTS...`)

// Run all tests with Node.js test runner
const testProcess = spawnSync('node', ['--test', ...preparedTestFiles], {
	stdio: 'inherit',
})

// Exit with the same code as the test process
// rmdirSync(distDir, {recursive:true})
rmdirSync(tempDir, { recursive: true })
process.exit(testProcess.status)
