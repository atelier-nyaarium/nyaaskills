import { describe, expect, it } from "bun:test";
import { appendItems, ProgressSchema } from "./run.ts";

describe("appendItems dedup", () => {
	it("without noDup, appends everything verbatim", () => {
		const r = appendItems(["a"], [], ["a", "a"], false);
		expect(r.items).toEqual(["a", "a", "a"]);
		expect(r.added).toBe(2);
		expect(r.dropped).toBe(0);
	});

	it("noDup normalizes (trim + trailing slash), dedups vs non-skipped, and re-allows a skipped item", () => {
		// existing ["a", "b/"], index 0 ("a") is skipped. Incoming: "a" re-allowed, "b" == "b/" dropped,
		// "c " normalizes to a fresh "c".
		const r = appendItems(["a", "b/"], [0], ["a", "b", "c "], true);
		expect(r.items).toEqual(["a", "b/", "a", "c "]);
		expect(r.added).toBe(2);
		expect(r.dropped).toBe(1);
	});

	it("noDup dedups the incoming batch against itself", () => {
		const r = appendItems([], [], ["x", "x", "y"], true);
		expect(r.items).toEqual(["x", "y"]);
		expect(r.dropped).toBe(1);
	});
});

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
