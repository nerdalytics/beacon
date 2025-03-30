import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { state, effect, derived } from "../src/index.ts";

/**
 * Tests for cleanup/unsubscribe behavior.
 *
 * These tests verify how the library handles state changes after
 * an effect has been cleaned up (unsubscribed).
 */
describe("Cleanup", { concurrency: true }, (): void => {
	it("should stop running effects after cleanup", (): void => {
		// Set up initial state
		const counter = state(1);

		// Track effect execution
		const executionLog: number[] = [];

		// Create an effect that depends on the counter
		const unsubscribe = effect(() => {
			executionLog.push(counter());
		});

		// Initial execution happens immediately
		assert.deepStrictEqual(executionLog, [1]);

		// Change state - effect should run
		counter.set(2);
		assert.deepStrictEqual(executionLog, [1, 2]);

		// Cleanup/unsubscribe the effect
		unsubscribe();

		// Change state again - effect should NOT run
		counter.set(3);
		assert.deepStrictEqual(
			executionLog,
			[1, 2],
			"Effect should not run after cleanup",
		);

		// Multiple updates should still not trigger the effect
		counter.set(4);
		counter.set(5);
		assert.deepStrictEqual(
			executionLog,
			[1, 2],
			"Effect should not run after multiple updates post-cleanup",
		);
	});

	it("should handle cleanup with multiple dependencies", (): void => {
		// Set up multiple states
		const a = state("a");
		const b = state("b");

		// Track effect executions
		const log: string[] = [];

		// Create an effect that depends on both states
		const unsubscribe = effect(() => {
			log.push(`${a()}-${b()}`);
		});

		// Initial execution
		assert.deepStrictEqual(log, ["a-b"]);

		// Both dependencies should trigger the effect
		a.set("x");
		assert.deepStrictEqual(log, ["a-b", "x-b"]);

		b.set("y");
		assert.deepStrictEqual(log, ["a-b", "x-b", "x-y"]);

		// Cleanup/unsubscribe
		unsubscribe();

		// Change both states - effect should NOT run
		a.set("z");
		b.set("w");
		assert.deepStrictEqual(
			log,
			["a-b", "x-b", "x-y"],
			"Effect should not run after cleanup, regardless of which dependency changes",
		);
	});

	it("should handle cleanup of derived signal's internal effect", (): void => {
		// Setup base states
		const counter = state(1);
		const multiplier = state(2);

		// Create derived with internal effect that depends on both states
		const product = derived(() => counter() * multiplier());

		// Verify initial value
		assert.strictEqual(product(), 2);

		// Change dependencies - derived should update
		counter.set(3);
		assert.strictEqual(product(), 6);

		multiplier.set(3);
		assert.strictEqual(product(), 9);

		// Keep track of effect executions for a separate effect
		const effectLog: number[] = [];
		const effectUnsubscribe = effect(() => {
			effectLog.push(product());
		});

		// Initial execution of our tracking effect
		assert.deepStrictEqual(effectLog, [9]);

		// Change both base states - derived and dependent effect should update
		counter.set(4);
		multiplier.set(4);
		assert.strictEqual(product(), 16);
		assert.deepStrictEqual(effectLog, [9, 12, 16]);

		// Unsubscribe the tracking effect
		effectUnsubscribe();

		// Change base states again
		counter.set(5);
		multiplier.set(5);

		// Derived signal should still update, but our effect should not run
		assert.strictEqual(
			product(),
			25,
			"Derived signal should still update after dependent effect is cleaned up",
		);
		assert.deepStrictEqual(
			effectLog,
			[9, 12, 16],
			"Effect should not run after cleanup, even when derived value changes",
		);
	});

	it("should handle complex dependency chains after cleanup", (): void => {
		// Set up a chain: a -> b -> c -> d
		const a = state(1);
		const b = derived(() => a() * 2);
		const c = derived(() => b() + 3);
		const d = derived(() => c() * 2);

		// Initial values
		assert.strictEqual(a(), 1);
		assert.strictEqual(b(), 2);
		assert.strictEqual(c(), 5);
		assert.strictEqual(d(), 10);

		// Track effect execution on the final derived value
		const log: number[] = [];
		const unsubscribe = effect(() => {
			log.push(d());
		});

		// Initial execution
		assert.deepStrictEqual(log, [10]);

		// Change root state - should propagate through the chain
		a.set(2);
		assert.strictEqual(a(), 2);
		assert.strictEqual(b(), 4);
		assert.strictEqual(c(), 7);
		assert.strictEqual(d(), 14);
		assert.deepStrictEqual(log, [10, 14]);

		// Cleanup the effect
		unsubscribe();

		// Change state again - chain should update but effect should not run
		a.set(3);

		// The chain should still update properly
		assert.strictEqual(a(), 3);
		assert.strictEqual(b(), 6);
		assert.strictEqual(c(), 9);
		assert.strictEqual(d(), 18);

		// But our effect should not have run
		assert.deepStrictEqual(
			log,
			[10, 14],
			"Effect should not run after cleanup, even with complex dependency chain",
		);
	});

	it("should handle interleaved cleanups and state changes", (): void => {
		// Set up state
		const a = state(0);
		const b = state(10);

		// Track multiple effects
		const logA: number[] = [];
		const logB: number[] = [];
		const logBoth: string[] = [];

		// Create three separate effects with different dependencies
		const unsubscribeA = effect(() => {
			logA.push(a());
		});

		const unsubscribeB = effect(() => {
			logB.push(b());
		});

		const unsubscribeBoth = effect(() => {
			logBoth.push(`${a()}-${b()}`);
		});

		// Initial executions
		assert.deepStrictEqual(logA, [0]);
		assert.deepStrictEqual(logB, [10]);
		assert.deepStrictEqual(logBoth, ["0-10"]);

		// Change state a - should trigger two effects
		a.set(1);
		assert.deepStrictEqual(logA, [0, 1]);
		assert.deepStrictEqual(logB, [10]);
		assert.deepStrictEqual(logBoth, ["0-10", "1-10"]);

		// Unsubscribe first effect only
		unsubscribeA();

		// Change a again - should trigger only the combined effect
		a.set(2);
		assert.deepStrictEqual(
			logA,
			[0, 1],
			"Effect A should not run after cleanup",
		);
		assert.deepStrictEqual(logB, [10]);
		assert.deepStrictEqual(logBoth, ["0-10", "1-10", "2-10"]);

		// Change b - should trigger B and combined effects
		b.set(20);
		assert.deepStrictEqual(logA, [0, 1]);
		assert.deepStrictEqual(logB, [10, 20]);
		assert.deepStrictEqual(logBoth, ["0-10", "1-10", "2-10", "2-20"]);

		// Unsubscribe combined effect
		unsubscribeBoth();

		// Change both states
		a.set(3);
		b.set(30);

		// Only B effect should still be running
		assert.deepStrictEqual(logA, [0, 1]);
		assert.deepStrictEqual(logB, [10, 20, 30]);
		assert.deepStrictEqual(logBoth, ["0-10", "1-10", "2-10", "2-20"]);

		// Unsubscribe last effect
		unsubscribeB();

		// Final state changes should affect no effects
		a.set(4);
		b.set(40);
		assert.deepStrictEqual(logA, [0, 1]);
		assert.deepStrictEqual(logB, [10, 20, 30]);
		assert.deepStrictEqual(logBoth, ["0-10", "1-10", "2-10", "2-20"]);
	});

	it("should handle cleanup while an update is in progress", (): void => {
		// Set up state and derived signals
		const a = state(1);
		const b = derived(() => a() * 2);

		// Flag to control effect behavior
		let shouldCleanup = false;
		let cleanupCalled = false;

		// Track effect executions
		const log: number[] = [];

		// Create an effect that reads b and potentially calls its own cleanup
		let unsubscribe: (() => void) | null = null;

		unsubscribe = effect(() => {
			const value = b();
			log.push(value);

			// Self-cleanup on condition
			if (shouldCleanup && unsubscribe) {
				cleanupCalled = true;
				unsubscribe();
			}
		});

		// Initial execution
		assert.deepStrictEqual(log, [2]);

		// Normal update
		a.set(2);
		assert.deepStrictEqual(log, [2, 4]);

		// Set flag to trigger self-cleanup on next run
		shouldCleanup = true;

		// Trigger update that will cause the effect to clean itself up
		a.set(3);

		// Effect should run once more and then clean itself up
		assert.deepStrictEqual(log, [2, 4, 6]);
		assert.strictEqual(cleanupCalled, true);

		// Further updates should not trigger the effect
		a.set(4);
		assert.deepStrictEqual(log, [2, 4, 6]);
	});
});
