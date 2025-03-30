import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/index.ts";

/**
 * Unit tests for the state functionality.
 *
 * This file contains unit tests for the state primitive, testing:
 * - Creation and initialization
 * - Value updates
 * - Value equality checks
 * - Complex object handling
 */
describe("State", { concurrency: true }, (): void => {
	it("should return the initial value", (): void => {
		const count = state(0);
		assert.strictEqual(count(), 0);
	});

	it("should update the value when set is called", (): void => {
		const count = state(0);
		count.set(1);
		assert.strictEqual(count(), 1);
	});

	it("should update the value when update is called", (): void => {
		const count = state(0);
		count.update((n: number): number => n + 1);
		assert.strictEqual(count(), 1);
	});

	it("should not update when value is equal (using Object.is)", (): void => {
		const callLog: number[] = [];
		const count = state(0);

		// Setup tracking
		const trackEffect = (): void => {
			callLog.push(count());
		};
		trackEffect();

		// Should not trigger for same value
		count.set(0);
		assert.deepStrictEqual(callLog, [0]);

		// Should trigger for different value
		count.set(1);
		assert.deepStrictEqual(callLog, [0]);
	});

	it("should handle complex object values", (): void => {
		const user = state({ name: "Alice", age: 30 });
		assert.deepStrictEqual(user(), { name: "Alice", age: 30 });

		user.set({ name: "Bob", age: 25 });
		assert.deepStrictEqual(user(), { name: "Bob", age: 25 });

		user.update(
			(current: {
				name: string;
				age: number;
			}): { age: number; name: string } => ({
				...current,
				age: current.age + 1,
			}),
		);
		assert.deepStrictEqual(user(), { name: "Bob", age: 26 });
	});
});
