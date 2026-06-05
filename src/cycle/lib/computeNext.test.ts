import { describe, expect, it } from "bun:test";
import { advance, applyLoop, type CycleProgress, findStep } from "./computeNext.ts";

const steps = ["propose", "audit", "triage", "rethink"];

describe("advance", () => {
	it("advances to the next step", () => {
		expect(advance(steps, "propose", 0)).toEqual({ kind: "advance", current: "audit", index: 1 });
	});
	it("reports lapEnd on the last step", () => {
		expect(advance(steps, "rethink", 3)).toEqual({ kind: "lapEnd" });
	});
	it("needs resolution when the current name is gone, suggesting via index", () => {
		expect(advance(steps, "gone", 2)).toEqual({ kind: "needsResolution", oldCurrent: "gone", suggested: "triage" });
	});
	it("throws on an empty step list", () => {
		expect(() => advance([], "x", 0)).toThrow("empty");
	});
	it("recovers to step 0 when the index fallback is not an integer", () => {
		expect(advance(steps, "gone", Number.NaN)).toEqual({
			kind: "needsResolution",
			oldCurrent: "gone",
			suggested: "propose",
		});
	});
});

describe("findStep", () => {
	it("resolves a step case-insensitively to its canonical casing", () => {
		expect(findStep(["Propose", "Audit"], "audit")).toBe("Audit");
	});
	it("returns null for an unknown step", () => {
		expect(findStep(["a", "b"], "z")).toBeNull();
	});
});

describe("applyLoop", () => {
	const base: CycleProgress = {
		name: "c",
		current: "rethink",
		index: 3,
		lap: 1,
		status: "active",
	};

	it("wraps to the first step and bumps the lap", () => {
		const r = applyLoop(base, steps);
		expect(r.current).toBe("propose");
		expect(r.index).toBe(0);
		expect(r.lap).toBe(2);
	});
	it("carries mode-specific fields (incl. in-flight batch) through the loop", () => {
		const items = {
			mode: "items",
			items: ["a", "b"],
			cursor: 1,
			spec: "do x",
			batchStart: 0,
			batchEnd: 1,
			batchSize: 1,
			skipped: [3],
		};
		const r = applyLoop({ ...base, ...items }, steps);
		expect(r.items).toEqual(["a", "b"]);
		expect(r.cursor).toBe(1);
		expect(r.spec).toBe("do x");
		expect(r.batchStart).toBe(0);
		expect(r.batchEnd).toBe(1);
		expect(r.batchSize).toBe(1);
		expect(r.skipped).toEqual([3]);
		expect(r.current).toBe("propose");
	});
	it("bumps the lap without any cap", () => {
		const r = applyLoop({ ...base, lap: 99 }, steps);
		expect(r.lap).toBe(100);
	});
	it("throws on an empty step list", () => {
		expect(() => applyLoop(base, [])).toThrow("empty");
	});
});
