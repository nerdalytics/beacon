/**
 * Script to update PERFORMANCE.md based on performance test results
 *
 * This script:
 * 1. Runs performance tests multiple times and captures metrics
 * 2. Applies statistical methods to get reliable values
 * 3. Stores metrics history in a JSON file
 * 4. Updates PERFORMANCE.md with the latest metrics
 * 5. Tracks performance trends over time
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Configuration
const METRICS_HISTORY_FILE = join(process.cwd(), 'performance-history.json')
const PERFORMANCE_MD_FILE = join(process.cwd(), 'PERFORMANCE.md')
const HISTORY_LIMIT = 10 // Number of historical entries to keep

// Performance test run configuration
const TEST_RUNS = 5 // Number of times to run each test
const STATISTIC_METHOD = 'median' // Options: 'median', 'average', 'max'
const WARM_UP_RUNS = 1 // Number of warm-up runs before collecting data

// Define the structure of performance metrics
interface PerformanceMetric {
	name: string
	value: number
	unit: string
	category: string
	description: string
}

interface RawPerformanceMetric {
	name: string
	values: number[]
	unit: string
	category: string
	description: string
}

interface PerformanceEntry {
	date: string
	commitHash: string
	metrics: PerformanceMetric[]
	runInfo: {
		runs: number
		statisticMethod: string
		warmUpRuns: number
	}
}

// Helper to format numbers with commas
const formatNumber = (num: number): string => {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Format numbers to a more readable form with appropriate units
const formatMetricValue = (value: number): string => {
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1)}M`
	} else if (value >= 1_000) {
		return `${(value / 1_000).toFixed(1)}K`
	} else {
		return value.toFixed(1)
	}
}

// Calculate median value from an array of numbers
function calculateMedian(values: number[]): number {
	if (values.length === 0) return 0

	const sorted = [...values].sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)

	if (sorted.length % 2 === 0) {
		return (sorted[middle - 1] + sorted[middle]) / 2
	}

	return sorted[middle]
}

// Calculate average value from an array of numbers
function calculateAverage(values: number[]): number {
	if (values.length === 0) return 0
	const sum = values.reduce((acc, val) => acc + val, 0)
	return sum / values.length
}

// Calculate max value from an array of numbers
function calculateMax(values: number[]): number {
	if (values.length === 0) return 0
	return Math.max(...values)
}

// Apply the configured statistical method to get a single value
function applyStatistic(values: number[], method: string): number {
	switch (method.toLowerCase()) {
		case 'median':
			return calculateMedian(values)
		case 'average':
			return calculateAverage(values)
		case 'max':
			return calculateMax(values)
		default:
			console.warn(`Unknown statistic method "${method}". Using median.`)
			return calculateMedian(values)
	}
}

// Run a single performance test and capture the output
function runSingleTest(): string {
	try {
		return execSync('npm run test:perf', { encoding: 'utf8' })
	} catch (error) {
		console.error('Error running performance test:', error)
		return ''
	}
}

// Run the performance tests multiple times and capture the output
function runPerformanceTests(): string[] {
	console.log(`Running ${WARM_UP_RUNS + TEST_RUNS} performance test iterations...`)
	const results: string[] = []

	// Run warm-up iterations
	if (WARM_UP_RUNS > 0) {
		console.log(`Performing ${WARM_UP_RUNS} warm-up run(s)...`)
		for (let i = 0; i < WARM_UP_RUNS; i++) {
			runSingleTest() // Discard the result
		}
	}

	// Run tests for collecting results
	console.log(`Collecting data from ${TEST_RUNS} test run(s)...`)
	for (let i = 0; i < TEST_RUNS; i++) {
		console.log(`- Running test iteration ${i + 1}/${TEST_RUNS}`)
		const output = runSingleTest()
		results.push(output)
	}

	return results
}

// Parse a single test output to extract metrics
function parseTestOutput(output: string): Map<string, number> {
	const metrics = new Map<string, number>()

	// Regular expressions to extract metrics
	const creationRegex = /Creating [\d,]+ signals: ([\d.]+)ms\s+Operations per second: ([\d,]+)\/s/
	const readRegex = /Reading signal [\d,]+ times: ([\d.]+)ms\s+Operations per second: ([\d,]+)\/s/
	const writeRegex = /Setting signal [\d,]+ times: ([\d.]+)ms\s+Operations per second: ([\d,]+)\/s/
	const derivedRegex = /Derived signal with [\d,]+ updates: ([\d.]+)ms\s+Operations per second: ([\d,]+)\/s/
	const effectRegex = /Effect with [\d,]+ triggers: ([\d.]+)ms\s+Operations per second: ([\d,]+)\/s/
	const batchRegex = /Batch with [\d,]+ batches of \d+ updates: ([\d.]+)ms\s+.*\s+Operations per second: ([\d,]+)\/s/
	const manyDepsRegex =
		/Handling \d+ dependencies with [\d,]+ iterations: ([\d.]+)ms\s+.*\s+Operations per second: ([\d,]+)\/s/
	const batchRatioRegex = /Performance ratio: ([\d.]+)x faster with batching/
	const effectRatioRegex = /Effect runs ratio: ([\d.]+)x fewer with batching/

	// Extract metrics using regex
	const creationMatch = output.match(creationRegex)
	if (creationMatch) {
		metrics.set('Signal Creation', parseInt(creationMatch[2].replace(/,/g, '')))
	}

	const readMatch = output.match(readRegex)
	if (readMatch) {
		metrics.set('Signal Reading', parseInt(readMatch[2].replace(/,/g, '')))
	}

	const writeMatch = output.match(writeRegex)
	if (writeMatch) {
		metrics.set('Signal Writing', parseInt(writeMatch[2].replace(/,/g, '')))
	}

	const derivedMatch = output.match(derivedRegex)
	if (derivedMatch) {
		metrics.set('Derived Signals', parseInt(derivedMatch[2].replace(/,/g, '')))
	}

	const effectMatch = output.match(effectRegex)
	if (effectMatch) {
		metrics.set('Effect Triggers', parseInt(effectMatch[2].replace(/,/g, '')))
	}

	const batchMatch = output.match(batchRegex)
	if (batchMatch) {
		metrics.set('Batch Updates', parseInt(batchMatch[2].replace(/,/g, '')))
	}

	const manyDepsMatch = output.match(manyDepsRegex)
	if (manyDepsMatch) {
		metrics.set('Many Dependencies', parseInt(manyDepsMatch[2].replace(/,/g, '')))
	}

	const batchRatioMatch = output.match(batchRatioRegex)
	if (batchRatioMatch) {
		metrics.set('Batch Performance Ratio', parseFloat(batchRatioMatch[1]))
	}

	const effectRatioMatch = output.match(effectRatioRegex)
	if (effectRatioMatch) {
		metrics.set('Batch Effect Reduction', parseFloat(effectRatioMatch[1]))
	}

	return metrics
}

// Combine multiple test runs and apply the statistical method
function processTestResults(testOutputs: string[]): PerformanceMetric[] {
	if (testOutputs.length === 0) {
		console.error('No test outputs to process!')
		return []
	}

	console.log(`Processing results from ${testOutputs.length} test runs using ${STATISTIC_METHOD}...`)

	// First parse individual outputs and collect all values for each metric
	const rawMetrics = new Map<string, RawPerformanceMetric>()

	const metricInfo = new Map<string, { unit: string; category: string; description: string }>()
	metricInfo.set('Signal Creation', { unit: 'ops/sec', category: 'Core', description: 'Creating new state signals' })
	metricInfo.set('Signal Reading', { unit: 'ops/sec', category: 'Core', description: 'Reading signal values' })
	metricInfo.set('Signal Writing', { unit: 'ops/sec', category: 'Core', description: 'Setting signal values' })
	metricInfo.set('Derived Signals', { unit: 'ops/sec', category: 'Core', description: 'Updates with derived values' })
	metricInfo.set('Effect Triggers', {
		unit: 'ops/sec',
		category: 'Core',
		description: 'Effects running on state changes',
	})
	metricInfo.set('Batch Updates', {
		unit: 'ops/sec',
		category: 'Core',
		description: 'Updating multiple signals in batches',
	})
	metricInfo.set('Many Dependencies', {
		unit: 'ops/sec',
		category: 'Advanced',
		description: '100 dependencies, 100 iterations',
	})
	metricInfo.set('Batch Performance Ratio', {
		unit: 'x',
		category: 'Comparison',
		description: 'Speed improvement with batching vs. individual updates',
	})
	metricInfo.set('Batch Effect Reduction', {
		unit: 'x',
		category: 'Comparison',
		description: 'Reduction in effect runs with batching',
	})

	for (const output of testOutputs) {
		const metrics = parseTestOutput(output)

		for (const [name, value] of metrics.entries()) {
			if (!rawMetrics.has(name)) {
				const info = metricInfo.get(name) || { unit: 'ops/sec', category: 'Unknown', description: name }
				rawMetrics.set(name, {
					name,
					values: [],
					unit: info.unit,
					category: info.category,
					description: info.description,
				})
			}

			const rawMetric = rawMetrics.get(name)!
			rawMetric.values.push(value)
		}
	}

	// Apply the statistical method to get a single value for each metric
	const finalMetrics: PerformanceMetric[] = []
	for (const rawMetric of rawMetrics.values()) {
		const value = applyStatistic(rawMetric.values, STATISTIC_METHOD)

		// Discard the multi-value array and keep a single value
		finalMetrics.push({
			name: rawMetric.name,
			value,
			unit: rawMetric.unit,
			category: rawMetric.category,
			description: rawMetric.description,
		})

		// Log the individual values for diagnostic purposes
		console.log(`${rawMetric.name}:
  - All values: ${rawMetric.values.map((v) => formatNumber(v)).join(', ')}
  - ${STATISTIC_METHOD}: ${formatNumber(value)}`)
	}

	return finalMetrics
}

// Get the current git commit hash (cached)
let gitCommitHash: string | null = null

function getCurrentCommitHash(): string {
	// Return cached value if already retrieved
	if (gitCommitHash !== null) {
		return gitCommitHash
	}

	try {
		// Suppress git's error output by redirecting stderr to /dev/null
		const cmd =
			process.platform === 'win32' ? 'git rev-parse --short HEAD 2> nul' : 'git rev-parse --short HEAD 2>/dev/null'

		gitCommitHash = execSync(cmd, { encoding: 'utf8' }).trim()
		return gitCommitHash
	} catch (error) {
		// Not a fatal error, just use a placeholder
		console.info('Note: Unable to get git commit hash (this is normal if not running in a git repository)')
		gitCommitHash = 'unknown'
		return gitCommitHash
	}
}

// Load performance history
function loadPerformanceHistory(): PerformanceEntry[] {
	if (!existsSync(METRICS_HISTORY_FILE)) {
		return []
	}

	try {
		const data = readFileSync(METRICS_HISTORY_FILE, 'utf8')
		return JSON.parse(data)
	} catch (error) {
		console.warn('Error loading performance history. Starting fresh.')
		return []
	}
}

// Save performance history
function savePerformanceHistory(history: PerformanceEntry[]): void {
	try {
		writeFileSync(METRICS_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8')
		console.log(`Performance history saved to ${METRICS_HISTORY_FILE}`)
	} catch (error) {
		console.error('Error saving performance history:', error)
	}
}

// Add new metrics to the history
function updatePerformanceHistory(metrics: PerformanceMetric[]): PerformanceEntry[] {
	const history = loadPerformanceHistory()

	const newEntry: PerformanceEntry = {
		date: new Date().toISOString(),
		commitHash: getCurrentCommitHash(),
		metrics: metrics,
		runInfo: {
			runs: TEST_RUNS,
			statisticMethod: STATISTIC_METHOD,
			warmUpRuns: WARM_UP_RUNS,
		},
	}

	// Add the new entry to the beginning of the array
	history.unshift(newEntry)

	// Keep only the most recent entries
	const trimmedHistory = history.slice(0, HISTORY_LIMIT)

	// Save the updated history
	savePerformanceHistory(trimmedHistory)

	return trimmedHistory
}

// Generate performance trend information
function calculateTrends(
	history: PerformanceEntry[]
): Map<string, { current: number; previous: number; change: number }> {
	if (history.length < 2) {
		return new Map()
	}

	const trends = new Map<string, { current: number; previous: number; change: number }>()

	const currentEntry = history[0]
	const previousEntry = history[1]

	for (const metric of currentEntry.metrics) {
		const previousMetric = previousEntry.metrics.find((m) => m.name === metric.name)

		if (previousMetric) {
			const current = metric.value
			const previous = previousMetric.value
			const change = ((current - previous) / previous) * 100

			trends.set(metric.name, { current, previous, change })
		}
	}

	return trends
}

// Generate trend indicator
function getTrendIndicator(change: number): string {
	if (change > 10) return '🟢 ↑' // Significant improvement
	if (change > 2) return '🟩 ↗' // Slight improvement
	if (change < -10) return '🟥 ↓' // Significant regression
	if (change < -2) return '🟧 ↘' // Slight regression
	return '⬜ →' // No significant change
}

// Generate PERFORMANCE.md content
function generatePerformanceMarkdown(metrics: PerformanceMetric[], history: PerformanceEntry[]): string {
	console.log('Generating PERFORMANCE.md content...')

	const trends = calculateTrends(history)

	// Group metrics by category
	const coreMetrics = metrics.filter((m) => m.category === 'Core')
	const advancedMetrics = metrics.filter((m) => m.category === 'Advanced')
	const comparisonMetrics = metrics.filter((m) => m.category === 'Comparison')

	let md = `# Beacon Performance Benchmarks

This document contains performance benchmarks for the Beacon library. These benchmarks measure the speed of various operations in the library.

*Last updated: ${new Date().toISOString().split('T')[0]} (commit: ${getCurrentCommitHash()})*

## Measurement Method

- **Test runs**: ${TEST_RUNS} iterations (with ${WARM_UP_RUNS} warm-up runs)
- **Statistical method**: ${STATISTIC_METHOD} value across all runs
- **Platform**: ${process.platform} / Node.js ${process.version}

## Key Metrics

| Operation | Speed | Change | Notes |
|-----------|-------|--------|-------|
`

	// Add core metrics to table
	for (const metric of coreMetrics) {
		const trend = trends.get(metric.name)
		const trendText = trend ? `${getTrendIndicator(trend.change)} ${trend.change.toFixed(1)}%` : ''

		md += `| ${metric.name} | ~${formatMetricValue(metric.value)} ${metric.unit} | ${trendText} | ${metric.description} |\n`
	}

	// Add advanced metrics to table
	for (const metric of advancedMetrics) {
		const trend = trends.get(metric.name)
		const trendText = trend ? `${getTrendIndicator(trend.change)} ${trend.change.toFixed(1)}%` : ''

		md += `| ${metric.name} | ~${formatMetricValue(metric.value)} ${metric.unit} | ${trendText} | ${metric.description} |\n`
	}

	// Add batch comparison section
	md += `
## Batched vs Unbatched Updates

When comparing batched and unbatched operations:

`

	for (const metric of comparisonMetrics) {
		md += `- **${metric.description}**: ${metric.name === 'Batch Performance Ratio' ? 'Batching is' : 'Batching reduces effect runs by'} ~${metric.value.toFixed(1)}${metric.unit}\n`
	}

	// Add analysis section
	md += `
## Analysis

The Beacon library shows excellent performance characteristics:

- **Reading is extremely fast**: At ~${formatMetricValue(coreMetrics.find((m) => m.name === 'Signal Reading')?.value || 0)} ops/sec, reading signals has minimal overhead
- **Writing is highly efficient**: At ~${formatMetricValue(coreMetrics.find((m) => m.name === 'Signal Writing')?.value || 0)} ops/sec, setting values is extremely fast
- **Batching is very effective**: Significantly reduces effect runs and improves performance by ${comparisonMetrics.find((m) => m.name === 'Batch Performance Ratio')?.value.toFixed(1) || 0}x

### Areas of Strength

- **Pure reads are near native speed**
- **Signal writes are optimized for high throughput**
- **Batching system provides significant optimization**
- **Core operations are all in the millions of ops/sec range**

### Potential Optimization Areas

- **Deep dependency chains**: Need careful handling to avoid stack overflow
- **Many dependencies**: Performance drops with large numbers of dependencies
`

	// Add performance history section if we have more than one entry
	if (history.length > 1) {
		md += `
## Performance History

The following chart shows performance trends over the last ${history.length} measurements:

| Metric | ${history.map((h, i) => `${i === 0 ? 'Current' : history.length - i + ' ago'}`).join(' | ')} |
|--------|${history.map(() => '------').join('|')}|
`

		// Add rows for each metric from the latest entry
		for (const metric of history[0].metrics) {
			md += `| ${metric.name} | `

			// Add values from each historical entry for this metric
			for (const entry of history) {
				const entryMetric = entry.metrics.find((m) => m.name === metric.name)
				if (entryMetric) {
					md += `${formatMetricValue(entryMetric.value)} ${entryMetric.unit} | `
				} else {
					md += `- | `
				}
			}

			md += `\n`
		}
	}

	// Add conclusion
	md += `
## Conclusion

The Beacon library provides excellent performance for reactive state management in Node.js applications. Its performance characteristics make it suitable for most server-side use cases, especially when proper batching is utilized to optimize updates.

For most applications, the library will not be a performance bottleneck, with operations measured in millions per second. The batching system provides an effective way to optimize updates when multiple state changes occur together.
`

	return md
}

// Update PERFORMANCE.md
function updatePerformanceMarkdown(markdown: string): void {
	console.log('Updating PERFORMANCE.md...')
	try {
		writeFileSync(PERFORMANCE_MD_FILE, markdown, 'utf8')
		console.log(`PERFORMANCE.md updated successfully.`)
	} catch (error) {
		console.error('Error updating PERFORMANCE.md:', error)
	}
}

// Main function
function main(): void {
	console.log('Updating performance documentation...')

	// Run performance tests multiple times
	const testOutputs = runPerformanceTests()

	if (testOutputs.length === 0) {
		console.error('No test outputs collected. Aborting.')
		process.exit(1)
	}

	// Process test results to get metrics
	const metrics = processTestResults(testOutputs)

	// Update performance history
	const history = updatePerformanceHistory(metrics)

	// Generate markdown
	const markdown = generatePerformanceMarkdown(metrics, history)

	// Update PERFORMANCE.md
	updatePerformanceMarkdown(markdown)

	console.log('Performance documentation update complete.')
}

// Run the script
main()
