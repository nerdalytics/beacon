import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { composeHook } from '../src/hooks/compose.ts'

describe('composeHook', { concurrency: true, timeout: 1000 }, () => {
	it('returns undefined for undefined input', () => {
		const result = composeHook(undefined)
		assert.strictEqual(result, undefined)
	})

	it('returns the function as-is for a single function', () => {
		const fn = (): void => {}
		const result = composeHook(fn)
		assert.strictEqual(result, fn)
	})

	it('returns undefined for an empty array', () => {
		const result = composeHook([])
		assert.strictEqual(result, undefined)
	})

	it('returns the element for a single-element array', () => {
		const fn = (): void => {}
		const result = composeHook([fn])
		assert.strictEqual(result, fn)
	})

	it('composes multiple functions in order', () => {
		const calls: number[] = []
		const fn1 = (): void => { calls.push(1) }
		const fn2 = (): void => { calls.push(2) }
		const fn3 = (): void => { calls.push(3) }
		const composed = composeHook([fn1, fn2, fn3])
		assert.notStrictEqual(composed, undefined)
		composed!()
		assert.deepStrictEqual(calls, [1, 2, 3])
	})

	it('forwards arguments to all hooks', () => {
		const received: unknown[][] = []
		const fn1 = (...args: unknown[]): void => { received.push(args) }
		const fn2 = (...args: unknown[]): void => { received.push(args) }
		const composed = composeHook<[string, number]>([fn1, fn2])
		composed!('hello', 42)
		assert.deepStrictEqual(received, [['hello', 42], ['hello', 42]])
	})

	it('isolates errors — one hook throws, others still run', () => {
		const calls: number[] = []
		const fn1 = (): void => { calls.push(1) }
		const fn2 = (): void => { throw new Error('boom') }
		const fn3 = (): void => { calls.push(3) }
		const composed = composeHook([fn1, fn2, fn3])
		composed!()
		assert.deepStrictEqual(calls, [1, 3])
	})
})
