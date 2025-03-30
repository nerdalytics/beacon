import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { state, derived } from "../src/index.ts";

/**
 * Unit tests for the derived functionality.
 *
 * This file contains unit tests for the derived primitive, testing:
 * - Computation of derived values
 * - Updates when dependencies change
 * - Multiple dependency handling
 * - Nested computations
 * - Recomputation optimization
 */
describe("Derived", { concurrency: true }, (): void => {
	it("should compute derived value", (): void => {
		const count = state(0);
		const doubled = derived((): number => count() * 2);
		assert.strictEqual(doubled(), 0);
	});

	it("should update when dependencies change", async (): Promise<void> => {
		const count = state(0);
		const doubled = derived((): number => count() * 2);
		count.set(1);

		assert.strictEqual(doubled(), 2);
	});

	it("should work with multiple dependencies", async (): Promise<void> => {
		const a = state(1);
		const b = state(2);
		const sum = derived((): number => a() + b());

		assert.strictEqual(sum(), 3);

		a.set(2);

		assert.strictEqual(sum(), 4);

		b.set(3);

		assert.strictEqual(sum(), 5);
	});

	it("should handle nested computations", async (): Promise<void> => {
		const count = state(0);
		const doubled = derived((): number => count() * 2);
		const quadrupled = derived((): number => doubled() * 2);

		assert.strictEqual(quadrupled(), 0);

		count.set(1);

		assert.strictEqual(doubled(), 2);
		assert.strictEqual(quadrupled(), 4);
	});

	it("should only recompute when necessary", async (): Promise<void> => {
		let computeCount = 0;

		const a = state(1);
		const b = state(2);

		const sum = derived((): number => {
			computeCount++;
			return a() + b();
		});

		// First read forces initialization
		assert.strictEqual(sum(), 3);

		// The signal is called once during the derived() initialization
		// and once when we read it above
		assert.strictEqual(computeCount, 2);

		// Reading again shouldn't recompute
		assert.strictEqual(sum(), 3);
		assert.strictEqual(computeCount, 2);

		// Updating a dependency should trigger recomputation
		a.set(2);

		assert.strictEqual(sum(), 4);
		assert.strictEqual(computeCount, 3);

		// Updating b dependency should trigger recomputation
		b.set(3);

		assert.strictEqual(sum(), 5);
		assert.strictEqual(computeCount, 4);
	});
});
