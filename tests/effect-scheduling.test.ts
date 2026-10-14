import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, effect, state } from '../src/index.ts'

const microtick = (): Promise<void> => new Promise((resolve): void => queueMicrotask(resolve))

async function turn(): Promise<void> {
	await microtick()
	await microtick()
}

describe('Effect Scheduling', {
	concurrency: false,
	timeout: 2000,
}, (): void => {
	it('sync schedule (default) runs before the write returns', (): void => {
		const s = state({
			n: 1,
		})
		let runs = 0
		const stop = effect((): void => {
			void s.n
			runs++
		})
		assert.equal(runs, 1)
		s.n = 2
		assert.equal(runs, 2)
		stop()
	})

	it('microtask schedule defers past the write', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let runs = 0
		const stop = effect(
			(): void => {
				void s.n
				runs++
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		assert.equal(runs, 1)
		s.n = 2
		assert.equal(runs, 1)
		await turn()
		assert.equal(runs, 2)
		stop()
	})

	it('coalesces same-turn writes into one run observing final values', async (): Promise<void> => {
		const s = state({
			a: 1,
			b: 1,
		})
		let runs = 0
		let seen = 0
		const stop = effect(
			(): void => {
				seen = s.a + s.b
				runs++
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		assert.equal(runs, 1)
		s.a = 2
		s.b = 2
		await turn()
		assert.equal(runs, 2)
		assert.equal(seen, 4)
		stop()
	})

	it('batch boundary precedes the microtask run', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let runs = 0
		const stop = effect(
			(): void => {
				void s.n
				runs++
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		batch((): void => {
			s.n = 2
			s.n = 3
		})
		assert.equal(runs, 1)
		await microtick()
		assert.equal(runs, 2)
		await turn()
		stop()
	})

	it('sync infinite-loop guard unchanged', (): void => {
		const s = state({
			n: 1,
		})
		assert.throws((): void => {
			effect((): void => {
				s.n = s.n + 1
			})
		}, /Infinite loop/)
	})

	it('microtask effect writing its own dependency re-runs per turn without guard error', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let runs = 0
		let first = true
		const stop = effect(
			(): void => {
				const n = s.n
				runs++
				if (!first && n < 3) s.n = n + 1
				first = false
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		s.n = 2
		await turn()
		await turn()
		await turn()
		assert.equal(runs, 3)
		assert.equal(s.n, 3)
		stop()
	})

	it('onSchedule fires at notification time for microtask effects', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let scheduled = 0
		let runs = 0
		const stop = effect(
			(): void => {
				void s.n
				runs++
			},
			'micro',
			{
				onSchedule: (): void => {
					scheduled++
				},
			},
			{
				schedule: 'microtask',
			}
		)
		s.n = 2
		assert.equal(scheduled, 1)
		assert.equal(runs, 1)
		stop()
		await turn()
	})
})
