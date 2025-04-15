import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { NewLineKind, ScriptTarget, createPrinter, createSourceFile } from 'typescript'

// Configuration
const sourceDir = './src'
const destDir = './dist/src'
const fileExtensions = ['.ts']

/**
 * Strip comments from TypeScript files
 */
// Log function that doesn't use console.log
function log(message: string): void {
	process.stdout.write(`${message}\n`)
}

function processFile(filePath: string, outputPath: string): void {
	// Read the file
	const sourceText = readFileSync(filePath, 'utf-8')

	// Parse the source file
	const sourceFile = createSourceFile(basename(filePath), sourceText, ScriptTarget.Latest, true)

	// Create a printer that removes comments
	const printer = createPrinter({
		removeComments: true,
		newLine: NewLineKind.LineFeed,
	})

	// Print the file without comments
	const result = printer.printFile(sourceFile)

	// Ensure output directory exists
	const outputDir = dirname(outputPath)
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true })
	}

	// Write the result
	writeFileSync(outputPath, result, 'utf-8')
	log(`Processed: ${filePath} -> ${outputPath}`)
}

/**
 * Process all TypeScript files in a directory recursively
 */
function processDirectory(sourceDir: string, outputDir: string): void {
	const entries = readdirSync(sourceDir, { withFileTypes: true })

	for (const entry of entries) {
		const sourcePath = join(sourceDir, entry.name)
		const outputPath = join(outputDir, entry.name)

		if (entry.isDirectory()) {
			// Recursively process subdirectories
			processDirectory(sourcePath, outputPath)
		} else if (entry.isFile() && fileExtensions.includes(extname(entry.name))) {
			// Process TypeScript files
			processFile(sourcePath, outputPath)
		}
	}
}

// Main execution
log('Starting comment stripping process...')
processDirectory(sourceDir, destDir)
log('Comment stripping complete!')
