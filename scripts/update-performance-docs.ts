/**
 * Script to update PERFORMANCE.md based on performance test results
 *
 * This script:
 * 1. Runs benchmarks using ./benchmark.ts
 * 2. Stores metrics history in a JSON file
 * 3. Updates PERFORMANCE.md with the latest metrics
 * 4. Tracks performance trends over time
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { BenchmarkResult } from './benchmark.ts'
import { runAllBenchmarks } from './benchmark.ts'

// Configuration
const METRICS_HISTORY_FILE = join(process.cwd(), 'performance-history.json')
const PERFORMANCE_MD_FILE = join(process.cwd(), 'PERFORMANCE.md')
const HISTORY_LIMIT = 10 // Number of historical entries to keep

// Define the structure of performance metrics
interface PerformanceMetric {
	name: string
	value: number
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
	}
}

// Format numbers to a more readable form with appropriate units
const formatMetricValue = (value: number): string => {
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1)}M`
	}
	if (value >= 1_000) {
		return `${(value / 1_000).toFixed(1)}K`
	}
	return value.toFixed(1)
}

// Helper to get category for a metric based on its name
function getCategoryForMetric(name: string): string {
	if (['Batch Performance Ratio', 'Batch Effect Reduction'].includes(name)) {
		return 'Comparison'
	}

	if (['Many Dependencies', 'Deep Dependency Chain'].includes(name)) {
		return 'Advanced'
	}

	if (['Update 100 States Individually', 'Update 100 States with Batching'].includes(name)) {
		return 'Batching'
	}

	return 'Core'
}

// Helper to get description for a metric based on its name
function getDescriptionForMetric(name: string): string {
	const descriptions: Record<string, string> = {
		'Signal Creation': 'Creating new state signals',
		'Signal Reading': 'Reading signal values',
		'Signal Writing': 'Setting signal values',
		'Derived Signals': 'Updates with derived values',
		'Effect Triggers': 'Effects running on state changes',
		'Update 100 States Individually': 'Updating multiple signals without batching',
		'Update 100 States with Batching': 'Updating multiple signals in batches',
		'Deep Dependency Chain': 'Chain of 10 derived signals',
		'Many Dependencies': '100 dependencies, 100 iterations',
		'Batch Performance Ratio': 'Speed improvement with batching vs. individual updates',
		'Batch Effect Reduction': 'Reduction in effect runs with batching',
	}

	return descriptions[name] || name
}

// Run the performance benchmarks and convert results to metrics
function runPerformanceTests(): PerformanceMetric[] {
	console.info('Running performance benchmarks...')

	// Run benchmarks directly
	const results = runAllBenchmarks()

	// Convert results to metrics format
	return results.map((result: BenchmarkResult) => ({
		name: result.name,
		value: result.opsPerSec,
		unit: result.name.includes('Ratio') || result.name.includes('Reduction') ? 'x' : 'ops/sec',
		category: getCategoryForMetric(result.name),
		description: getDescriptionForMetric(result.name),
	}))
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
	} catch {
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
	} catch {
		console.warn('Error loading performance history. Starting fresh.')
		return []
	}
}

// Save performance history
function savePerformanceHistory(history: PerformanceEntry[]): void {
	try {
		writeFileSync(METRICS_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8')
		console.info(`Performance history saved to ${METRICS_HISTORY_FILE}`)
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
			runs: 5, // From benchmark.ts ITERATIONS constant
			statisticMethod: 'median',
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
		const previousMetric = previousEntry.metrics.find((m: PerformanceMetric): boolean => m.name === metric.name)

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
	if (change > 10) {
		// Significant improvement
		return '🟢 ↑'
	}
	if (change > 2) {
		// Slight improvement
		return '🟩 ↗'
	}
	if (change < -10) {
		// Significant regression
		return '🟥 ↓'
	}
	if (change < -2) {
		// Slight regression
		return '🟧 ↘'
	}
	// No significant change
	return '⬜ →'
}

// Generate PERFORMANCE.md content
function generatePerformanceMarkdown(metrics: PerformanceMetric[], history: PerformanceEntry[]): string {
	console.info('Generating PERFORMANCE.md content...')

	const trends = calculateTrends(history)

	// Group metrics by category
	const coreMetrics = metrics.filter((m: PerformanceMetric): boolean => m.category === 'Core')
	const advancedMetrics = metrics.filter((m: PerformanceMetric): boolean => m.category === 'Advanced')
	const batchingMetrics = metrics.filter((m: PerformanceMetric): boolean => m.category === 'Batching')
	const comparisonMetrics = metrics.filter((m: PerformanceMetric): boolean => m.category === 'Comparison')

	let md = `# Beacon Performance Benchmarks

This document contains performance benchmarks for the Beacon library. These benchmarks measure the speed of various operations in the library.

*Last updated: ${new Date().toISOString().split('T')[0]} (commit: ${getCurrentCommitHash()})*

## Measurement Method

- **Test runs**: ${history[0]?.runInfo.runs || 5} iterations with 2 warm-up runs
- **Statistical method**: Median value across all runs
- **Platform**: ${process.platform} / Node.js ${process.version}

## Core Operations

These metrics measure the performance of fundamental operations in isolation:

| Operation | Speed | Change | Notes |
|-----------|-------|--------|-------|
`

	// Add core metrics to table
	for (const metric of coreMetrics) {
		const trend = trends.get(metric.name)
		const trendText = trend ? `${getTrendIndicator(trend.change)} ${trend.change.toFixed(1)}%` : ''

		md += `| ${metric.name} | ~${formatMetricValue(metric.value)} ${metric.unit} | ${trendText} | ${metric.description} |\n`
	}

	// Add batching comparison section
	if (batchingMetrics.length > 0) {
		md += `
## Batching Performance

These metrics compare performance with and without batching for the same operations:

| Operation | Speed | Change | Notes |
|-----------|-------|--------|-------|
`

		// Add batching metrics to table
		for (const metric of batchingMetrics) {
			const trend = trends.get(metric.name)
			const trendText = trend ? `${getTrendIndicator(trend.change)} ${trend.change.toFixed(1)}%` : ''

			md += `| ${metric.name} | ~${formatMetricValue(metric.value)} ${metric.unit} | ${trendText} | ${metric.description} |\n`
		}
	}

	// Add advanced metrics section
	if (advancedMetrics.length > 0) {
		md += `
## Advanced Scenarios

These metrics measure performance in more complex scenarios:

| Operation | Speed | Change | Notes |
|-----------|-------|--------|-------|
`

		// Add advanced metrics to table
		for (const metric of advancedMetrics) {
			const trend = trends.get(metric.name)
			const trendText = trend ? `${getTrendIndicator(trend.change)} ${trend.change.toFixed(1)}%` : ''

			md += `| ${metric.name} | ~${formatMetricValue(metric.value)} ${metric.unit} | ${trendText} | ${metric.description} |\n`
		}
	}

	// Find the specific ratio metrics
	const perfRatio = comparisonMetrics.find((m: PerformanceMetric): boolean => m.name === 'Batch Performance Ratio')?.value || 0
	const effectReduction = comparisonMetrics.find((m: PerformanceMetric): boolean => m.name === 'Batch Effect Reduction')?.value || 0

	// Add batch comparison results with detailed explanation and measured values
	const effectPercentage = (100 / effectReduction).toFixed(1)

	md += `
## Batching Benefits

When comparing batched and unbatched operations for the same workload (100 states updated 100 times):

- **Speed improvement**: Batching is ~${perfRatio.toFixed(1)}x faster in operations per second
- **Effect efficiency**: Batching triggers only ${effectPercentage}% of the effect runs (${effectReduction.toFixed(1)}x reduction)

These complementary metrics measure different aspects of the same optimization:

1. **Performance Ratio (${perfRatio.toFixed(1)}x)**:
   - Measures raw throughput in operations per second
   - Shows how many more operations you can perform in the same time period
   - Higher is better (more operations per second)

2. **Effect Reduction (${effectReduction.toFixed(1)}x)**:
   - Measures efficiency in triggering effects
   - Shows how many fewer side effects run with batching
   - Higher is better (fewer unnecessary effect executions)

The effect reduction is calculated from the measured effect runs:
- Without batching: ~${(effectReduction * 99).toFixed(0)} effect runs (one per state update)
- With batching: ~99 effect runs (one per batch of 100 state updates)
- Result: ${effectReduction.toFixed(1)}× fewer effect runs with batching (${effectPercentage}% of original)
`

	// Add detailed analysis section
	md += `
## Analysis

The Beacon library shows excellent performance characteristics:

- **Reading is extremely fast**: At ~${formatMetricValue(coreMetrics.find((m: PerformanceMetric): boolean => m.name === 'Signal Reading')?.value || 0)} ops/sec, reading signals has minimal overhead
- **Writing is highly efficient**: At ~${formatMetricValue(coreMetrics.find((m: PerformanceMetric): boolean => m.name === 'Signal Writing')?.value || 0)} ops/sec, setting values is extremely fast
- **Batching provides dual benefits**:
  1. ~${perfRatio.toFixed(1)}x faster throughput (operations per second)
  2. ~${effectReduction.toFixed(1)}x reduction in effect executions (${(100 / effectReduction).toFixed(1)}% of original)

### Areas of Strength

- **Pure reads are near native speed**: Reading states without effects approaches native JavaScript speed
- **Signal writes are optimized**: Direct state updates are very efficient
- **Batching is highly effective**: For real-world scenarios with multiple related states, batching provides significant benefits
- **Derived signals have low overhead**: Computing values from state is efficient

### When to Use Batching

Batching is particularly important when:
- Updating multiple states that share effects or derived dependencies
- Performing sequences of updates that should be treated as a single transaction
- Working with complex data structures broken into multiple state containers
- Updating state in response to external events (API calls, user input, etc.)

### Potential Optimization Areas

- **Deep dependency chains**: Long chains of derived signals should be managed carefully
- **Many dependencies**: Performance can drop with large numbers of dependencies in a single derived signal
`

	// Add performance history section if we have more than one entry
	if (history.length > 1) {
		md += `
## Performance History

The following chart shows performance trends over the last ${history.length} measurements:

| Metric | ${history.map((_h: PerformanceEntry, i: number): string => `${i === 0 ? 'Current' : `${history.length - i} ago`}`).join(' | ')} |
|--------|${history.map((): string => '------').join('|')}|
`

		// Add rows for each metric from the latest entry
		for (const metric of history[0].metrics) {
			md += `| ${metric.name} | `

			// Add values from each historical entry for this metric
			for (const entry of history) {
				const entryMetric = entry.metrics.find((m: PerformanceMetric): boolean => m.name === metric.name)
				if (entryMetric) {
					// Format differently based on metric type (ratio/reduction vs regular metrics)
					if (entryMetric.name.includes('Ratio') || entryMetric.name.includes('Reduction')) {
						// Always use 'x' as the unit for ratio/reduction metrics, regardless of what's in the data
						md += `${entryMetric.value.toFixed(1)}x | `
					} else {
						md += `${formatMetricValue(entryMetric.value)} ${entryMetric.unit} | `
					}
				} else {
					md += '- | '
				}
			}

			md += '\n'
		}
	}

	// Add detailed conclusion with specific measured benefits
	md += `
## Conclusion

The Beacon library provides excellent performance for reactive state management in Node.js applications, with:

- Core operations in the tens of millions per second range
- State reading at ~${formatMetricValue(coreMetrics.find((m: PerformanceMetric): boolean => m.name === 'Signal Reading')?.value || 0)} operations/second
- State writing at ~${formatMetricValue(coreMetrics.find((m: PerformanceMetric): boolean => m.name === 'Signal Writing')?.value || 0)} operations/second

For real-world usage scenarios, these benchmarks demonstrate clear performance guidelines:

1. **Always use batching for multiple updates**:
   - ${perfRatio.toFixed(1)}x faster operation throughput
   - ${effectReduction.toFixed(1)}x reduction in effect triggers
   - Most important for components with shared dependencies

2. **Optimize dependency tracking**:
   - Minimize deep dependency chains when possible
   - Be mindful of effects with many dependencies
   - Performance can drop with overly complex dependency networks

For most applications, Beacon will not be a performance bottleneck and provides an excellent balance of developer experience and runtime efficiency.
`

	return md
}

// Update PERFORMANCE.md
function updatePerformanceMarkdown(markdown: string): void {
	console.info('Updating PERFORMANCE.md...')
	try {
		writeFileSync(PERFORMANCE_MD_FILE, markdown, 'utf8')
		console.info('PERFORMANCE.md updated successfully.')
	} catch (error) {
		console.error('Error updating PERFORMANCE.md:', error)
	}
}

// Main function
function main(): void {
	console.info('Updating performance documentation...')

	// Run performance benchmarks
	const metrics = runPerformanceTests()

	if (metrics.length === 0) {
		console.error('No benchmark results collected. Aborting.')
		process.exit(1)
	}

	// Update performance history
	const history = updatePerformanceHistory(metrics)

	// Generate markdown
	const markdown = generatePerformanceMarkdown(metrics, history)

	// Update PERFORMANCE.md
	updatePerformanceMarkdown(markdown)

	console.info('Performance documentation update complete.')
}

// Run the script
try {
	main()
} catch (error) {
	console.error('Error updating performance docs:', error)
	process.exit(1)
}
