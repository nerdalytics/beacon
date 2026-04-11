import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { effect, state } from '../src/index.ts'

describe('Effect Hooks', {
	concurrency: true,
	timeout: 1000,
}, () => {
	it('works without hooks (backward compat)', () => {
		let ran = false
		const dispose = effect(() => {
			ran = true
		})
		assert.strictEqual(ran, true)
		dispose()
	})

	it('works with name and no hooks (backward compat)', () => {
		let ran = false
		const dispose = effect(() => {
			ran = true
		}, 'test')
		assert.strictEqual(ran, true)
		dispose()
	})

	it('fires onRun with effectName', () => {
		const names: (string | undefined)[] = []
		const dispose = effect(() => {}, 'myEffect', {
			onRun: (name: string | undefined) => {
				names.push(name)
			},
		})
		assert.deepStrictEqual(names, [
			'myEffect',
		])
		dispose()
	})

	it('fires onDispose with effectName', () => {
		const names: (string | undefined)[] = []
		const dispose = effect(() => {}, 'myEffect', {
			onDispose: (name: string | undefined) => {
				names.push(name)
			},
		})
		dispose()
		assert.deepStrictEqual(names, [
			'myEffect',
		])
	})

	it('fires onError when effect throws and re-throws', () => {
		const errors: Error[] = []
		assert.throws(
			() => {
				effect(
					() => {
						throw new Error('boom')
					},
					'failing',
					{
						onError: (err: Error) => {
							errors.push(err)
						},
					}
				)
			},
			{
				message: 'boom',
			}
		)
		assert.strictEqual(errors.length, 1)
		assert.strictEqual(errors[0]?.message, 'boom')
	})

	it('fires onDependencyAdd for new dependencies', () => {
		const deps: [
			object,
			PropertyKey,
			string | undefined,
		][] = []
		const $s = state({
			count: 0,
		})
		const dispose = effect(
			() => {
				const _v = $s.count
			},
			'tracker',
			{
				onDependencyAdd: (target: object, prop: PropertyKey, name: string | undefined) => {
					deps.push([
						target,
						prop,
						name,
					])
				},
			}
		)
		assert.ok(deps.length > 0)
		assert.strictEqual(
			deps.some((d) => d[1] === 'count'),
			true
		)
		assert.strictEqual(deps[0]?.[2], 'tracker')
		dispose()
	})

	it('fires onSchedule when effect is queued for re-run', () => {
		const schedules: (string | undefined)[] = []
		const $s = state({
			count: 0,
		})
		const dispose = effect(
			() => {
				const _v = $s.count
			},
			'watcher',
			{
				onSchedule: (name: string | undefined) => {
					schedules.push(name)
				},
			}
		)
		$s.count = 1
		assert.ok(schedules.length > 0)
		assert.strictEqual(schedules[0], 'watcher')
		dispose()
	})

	it('isolates hook errors from effect execution', () => {
		let ran = false
		const dispose = effect(
			() => {
				ran = true
			},
			'safe',
			{
				onRun: () => {
					throw new Error('hook error')
				},
			}
		)
		assert.strictEqual(ran, true)
		dispose()
	})
})
