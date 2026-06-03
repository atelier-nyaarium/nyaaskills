import { describe, expect, it } from "bun:test";
import { ProgressSchema } from "./run.ts";

describe("ProgressSchema mode discriminant", () => {
	const planRecord = { name: "c", current: "a", index: 0, lap: 1, status: "active" };
	const itemsRecord = {
		...planRecord,
		mode: "items",
		spec: "do x",
		items: ["a", "b"],
		cursor: 0,
		batchStart: 0,
		batchEnd: 1,
		batchSize: 1,
		skipped: [],
	};

	it("defaults a modeless sidecar to plan mode (back-compat)", () => {
		const parsed = ProgressSchema.safeParse(planRecord);
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.mode).toBe("plan");
	});

	it("strips unknown legacy fields rather than failing", () => {
		const parsed = ProgressSchema.safeParse({ ...planRecord, body_hash: "x", unchanged_laps: 3 });
		expect(parsed.success).toBe(true);
		if (parsed.success) expect("body_hash" in parsed.data).toBe(false);
	});

	it("accepts a fully-populated items record", () => {
		expect(ProgressSchema.safeParse(itemsRecord).success).toBe(true);
	});

	it("rejects a half-populated items record (items fields are co-required)", () => {
		const halfItems = { ...planRecord, mode: "items", spec: "do x" };
		expect(ProgressSchema.safeParse(halfItems).success).toBe(false);
	});
});
