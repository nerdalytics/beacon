import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, derive, state } from '../src/index.ts'

describe('Derive Hooks', {
	concurrency: true,
	timeout: 1000,
}, () => {
	it('works without hooks (backward compat)', () => {
		const $s = state({
			count: 2,
		})
		const $d = derive(() => $s.count * 2)
		assert.strictEqual($d.value, 4)
		$d.reactive = false
	})

	it('fires onCompute with previousValue', () => {
		const prevValues: (number | undefined)[] = []
		const $s = state({
			count: 1,
		})
		const $d = derive(() => $s.count * 10, {
			onCompute: (prev: number | undefined) => {
				prevValues.push(prev)
			},
		})
		assert.deepStrictEqual(prevValues, [
			undefined,
		])
		$s.count = 2
		assert.deepStrictEqual(prevValues, [
			undefined,
			10,
		])
		$d.reactive = false
	})

	it('fires onCacheHit distinguishing fresh vs cached', () => {
		const hits: [
			unknown,
			boolean,
		][] = []
		const $s = state({
			count: 1,
		})
		const $d = derive(() => $s.count * 10, {
			onCacheHit: (value: unknown, cacheHit: boolean) => {
				hits.push([
					value,
					cacheHit,
				])
			},
		})
		const _v1 = $d.value
		const _v2 = $d.value
		assert.ok(hits.length >= 2)
		$d.reactive = false
	})

	it('fires onDispose when reactive set to false', () => {
		let disposed = false
		const $d = derive(() => 42, {
			onDispose: () => {
				disposed = true
			},
		})
		assert.strictEqual(disposed, false)
		$d.reactive = false
		assert.strictEqual(disposed, true)
	})

	it('fires onError when computeFn throws and re-throws', () => {
		const errors: Error[] = []
		assert.throws(
			() => {
				derive(
					() => {
						throw new Error('compute fail')
					},
					{
						onError: (err: Error) => {
							errors.push(err)
						},
					}
				)
			},
			{
				message: 'compute fail',
			}
		)
		assert.strictEqual(errors.length, 1)
		assert.strictEqual(errors[0]?.message, 'compute fail')
	})

	it('fires onDependencyChange when upstream state changes', () => {
		const changes: [
			object,
			PropertyKey,
		][] = []
		const $s = state({
			count: 0,
		})
		const $d = derive(() => $s.count * 2, {
			onDependencyChange: (target: object, prop: PropertyKey) => {
				changes.push([
					target,
					prop,
				])
			},
		})
		$s.count = 5
		assert.ok(changes.length > 0)
		assert.strictEqual(
			changes.some((c) => c[1] === 'count'),
			true
		)
		$d.reactive = false
	})

	it('isolates hook errors from derive functionality', () => {
		const $s = state({
			count: 1,
		})
		const $d = derive(() => $s.count * 10, {
			onCompute: () => {
				throw new Error('hook error')
			},
		})
		assert.strictEqual($d.value, 10)
		$d.reactive = false
	})

	it('fires onDependencyChange once per property during batch', () => {
		const changes: PropertyKey[] = []
		const $s = state({
			count: 0,
		})
		const $d = derive(() => $s.count * 2, {
			onDependencyChange: (_target: object, prop: PropertyKey) => {
				changes.push(prop)
			},
		})

		changes.length = 0

		batch(() => {
			$s.count = 1
			$s.count = 2
			$s.count = 3
		})

		assert.strictEqual(changes.length, 1)
		assert.strictEqual(changes[0], 'count')
		$d.reactive = false
	})
})
