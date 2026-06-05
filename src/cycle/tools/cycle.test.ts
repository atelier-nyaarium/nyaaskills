import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toolsCycle } from "../index.ts";
import { cycleAppendItems } from "./cycleAppendItems.ts";
import { cycleCheckpoint } from "./cycleCheckpoint.ts";
import { cycleGoto } from "./cycleGoto.ts";
import { cycleList } from "./cycleList.ts";
import { cycleNext } from "./cycleNext.ts";
import { cycleStartItems } from "./cycleStartItems.ts";
import { cycleStartPlan } from "./cycleStartPlan.ts";
import { cycleStatus } from "./cycleStatus.ts";

let cwd: string;
let cyclesDir: string;
const prevEnv = process.env.NYAASKILLS_CYCLES_DIR;

// biome-ignore lint/suspicious/noExplicitAny: test helper unwraps the tool's { data } envelope.
async function run(tool: { handler: (cwd: string, args: any) => Promise<unknown> }, args: any): Promise<any> {
	const out = (await tool.handler(cwd, args)) as { data: unknown };
	return out.data;
}

// Most tests want a started cycle, not the step-confirmation bounce, so default includeSteps to the
// full suite. Tests that exercise the bounce/includeSteps call cycleStart* through `run` directly.
// biome-ignore lint/suspicious/noExplicitAny: thin start wrappers, unwrap the { data } envelope.
const startPlan = async (args: any): Promise<any> =>
	((await cycleStartPlan.handler(cwd, { includeSteps: ["all"], ...args })) as { data: unknown }).data;
// biome-ignore lint/suspicious/noExplicitAny: thin start wrappers, unwrap the { data } envelope.
const startItems = async (args: any): Promise<any> =>
	((await cycleStartItems.handler(cwd, { includeSteps: ["all"], ...args })) as { data: unknown }).data;

// Progress lives in `<plan>.cycle.json`; corrupt that sidecar to simulate drift/corruption.
function corruptSidecar(plan: string, mutate: (p: Record<string, unknown>) => void): void {
	const sc = path.join(cwd, plan.replace(/\.md$/, ".cycle.json"));
	const prog = JSON.parse(fs.readFileSync(sc, "utf8"));
	mutate(prog);
	fs.writeFileSync(sc, JSON.stringify(prog));
}

beforeAll(() => {
	cyclesDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cyclesdef-")));
	process.env.NYAASKILLS_CYCLES_DIR = cyclesDir;
	fs.writeFileSync(
		path.join(cyclesDir, "demo.md"),
		"---\nsteps: [a, b, c]\n---\n## a\nAlpha\n## b\nBeta\n## c\nGamma\n",
	);
});

afterAll(() => {
	if (prevEnv === undefined) delete process.env.NYAASKILLS_CYCLES_DIR;
	else process.env.NYAASKILLS_CYCLES_DIR = prevEnv;
	fs.rmSync(cyclesDir, { recursive: true, force: true });
});

beforeEach(() => {
	cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cyclecwd-")));
});

describe("cycle tool lifecycle", () => {
	it("starts, steps, ends a lap, loops, and finishes", async () => {
		const start = await startPlan({ plan: "plan.md", cycle: "demo" });
		expect(start.step).toBe("a");
		expect(start.status).toBe("active");
		expect(start.steps).toEqual(["a", "b", "c"]);
		expect(start.instructions).toContain("Alpha");
		expect(start.instructions).toContain('cycleNext({ plan: "plan.md", completed: "a" })');
		expect(start.lap).toBe(1);

		// Progress lives in a sidecar; the tool never creates or touches the plan doc.
		expect(fs.existsSync(path.join(cwd, "plan.cycle.json"))).toBe(true);
		expect(fs.existsSync(path.join(cwd, "plan.md"))).toBe(false);

		// Bare step (no completed) does not advance.
		const peek = await run(cycleNext, { plan: "plan.md" });
		expect(peek.advanced).toBe(false);
		expect(peek.step).toBe("a");

		expect((await run(cycleNext, { plan: "plan.md", completed: "a" })).step).toBe("b");
		expect((await run(cycleNext, { plan: "plan.md", completed: "b" })).step).toBe("c");

		const end = await run(cycleNext, { plan: "plan.md", completed: "c" });
		expect(end.lapEnd).toBe(true);
		expect(end.advanced).toBe(false);

		const looped = await run(cycleCheckpoint, { plan: "plan.md", decision: "loop", summary: "did a lap" });
		expect(looped.lap).toBe(2);
		expect(looped.step).toBe("a");

		const status = await run(cycleStatus, { plan: "plan.md" });
		expect(status.initialized).toBe(true);
		expect(status.lap).toBe(2);
		expect(status.step).toBe("a");

		const done = await run(cycleCheckpoint, { plan: "plan.md", decision: "done", summary: "solid" });
		expect(done.status).toBe("done");

		// "done" clears the sidecar: the plan reads as uninitialized and cannot be resumed.
		expect((await run(cycleStatus, { plan: "plan.md" })).initialized).toBe(false);
		await expect(run(cycleNext, { plan: "plan.md", completed: "a" })).rejects.toThrow("no cycle on this plan");
	});

	it("case-insensitive completed echo advances", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		expect((await run(cycleNext, { plan: "p.md", completed: "A" })).step).toBe("b");
	});

	it("refuses to clobber an active cycle without force", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		await expect(startPlan({ plan: "p.md", cycle: "demo" })).rejects.toThrow("force");
		const forced = await startPlan({ plan: "p.md", cycle: "demo", force: true });
		expect(forced.step).toBe("a");
	});

	it("goto jumps to a step case-insensitively and reopens a finished cycle", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		await run(cycleCheckpoint, { plan: "p.md", decision: "critical-stop", summary: "halt" });
		const goto = await run(cycleGoto, { plan: "p.md", step: "C" });
		expect(goto.step).toBe("c");
		expect(goto.status).toBe("active");
	});

	it("goto with resetLap resets the lap to 1", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		await run(cycleNext, { plan: "p.md", completed: "a" });
		await run(cycleNext, { plan: "p.md", completed: "b" });
		await run(cycleNext, { plan: "p.md", completed: "c" });
		await run(cycleCheckpoint, { plan: "p.md", decision: "loop", summary: "lap" });
		const reset = await run(cycleGoto, { plan: "p.md", step: "a", resetLap: true });
		expect(reset.lap).toBe(1);
	});

	it("errors when stepping before start", async () => {
		await expect(run(cycleNext, { plan: "missing.md" })).rejects.toThrow("no cycle on this plan");
	});

	it("returns needsResolution (not a throw) when the current step left the definition", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		corruptSidecar("p.md", (p) => {
			p.current = "ghost";
		});
		const stepped = await run(cycleNext, { plan: "p.md", completed: "ghost" });
		expect(stepped.needsResolution).toBe(true);
		expect(stepped.advanced).toBe(false);
		const status = await run(cycleStatus, { plan: "p.md" });
		expect(status.initialized).toBe(true);
		expect(status.error).toContain("no longer");
	});

	it("status reports an error (not a throw) when the definition is gone", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		corruptSidecar("p.md", (p) => {
			p.name = "vanished";
		});
		const status = await run(cycleStatus, { plan: "p.md" });
		expect(status.initialized).toBe(true);
		expect(status.error).toContain("unknown cycle");
	});

	it("guards a malformed cycle block from being clobbered without force", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		corruptSidecar("p.md", (p) => {
			p.status = "bogus";
		});
		const status = await run(cycleStatus, { plan: "p.md" });
		expect(status.initialized).toBe(false);
		expect(status.malformed).toBe(true);
		await expect(startPlan({ plan: "p.md", cycle: "demo" })).rejects.toThrow("malformed");
		expect((await startPlan({ plan: "p.md", cycle: "demo", force: true })).step).toBe("a");
	});

	it("lists available cycle definitions", async () => {
		const list = await run(cycleList, {});
		const names = list.cycles.map((c: { name: string }) => c.name);
		expect(names).toContain("demo");
	});
});

describe("cycle items mode", () => {
	const itemsSidecar = (name: string) =>
		JSON.parse(fs.readFileSync(path.join(cwd, "plans", `${name}.cycle.json`), "utf8"));

	it("writes the queue + spec sidecar and injects the first batch", async () => {
		const start = await startItems({
			name: "migrate",
			cycle: "demo",
			spec: "Add a header to each file",
			items: ["a.ts", "b.ts", "c.ts"],
			batchSize: 2,
		});
		expect(start.step).toBe("a");
		expect(start.plan).toBe("plans/migrate.md");
		expect(start.totalItems).toBe(3);
		expect(start.instructions).toContain("Add a header to each file");
		expect(start.instructions).toContain("a.ts");
		expect(start.instructions).toContain("b.ts");
		expect(start.instructions).not.toContain("c.ts"); // beyond the first batch

		const prog = itemsSidecar("migrate");
		expect(prog.mode).toBe("items");
		expect(prog.items).toEqual(["a.ts", "b.ts", "c.ts"]);
		expect(prog.cursor).toBe(0);
		expect(prog.batchStart).toBe(0);
		expect(prog.batchEnd).toBe(2);
		expect(prog.spec).toBe("Add a header to each file");
	});

	it("defaults batchSize to 1 and clamps batchEnd to the queue length", async () => {
		const start = await startItems({ name: "tiny", cycle: "demo", spec: "x", items: ["only.ts"] });
		expect(start.batchSize).toBe(1);
		expect(itemsSidecar("tiny").batchEnd).toBe(1);
	});

	it("rejects an empty queue and a path-traversal name", async () => {
		await expect(startItems({ name: "ok", cycle: "demo", spec: "x", items: [] })).rejects.toThrow();
		await expect(startItems({ name: "../escape", cycle: "demo", spec: "x", items: ["a"] })).rejects.toThrow();
	});

	it("refuses to clobber an active run under the same name", async () => {
		await startItems({ name: "busy", cycle: "demo", spec: "x", items: ["a"] });
		await expect(startItems({ name: "busy", cycle: "demo", spec: "y", items: ["b"] })).rejects.toThrow(
			"already active",
		);
	});

	// Step through the demo cycle's a/b/c steps for one batch, ending at the lap checkpoint.
	const runBatchSteps = async (name: string) => {
		await run(cycleNext, { plan: `plans/${name}.md`, completed: "a" });
		await run(cycleNext, { plan: `plans/${name}.md`, completed: "b" });
		await run(cycleNext, { plan: `plans/${name}.md`, completed: "c" });
	};

	it("loop advances batch to batch, preserving the queue (load-bearing fix)", async () => {
		await startItems({
			name: "keep",
			cycle: "demo",
			spec: "x",
			items: ["i1", "i2", "i3", "i4"],
			batchSize: 2,
		});
		await runBatchSteps("keep");
		const looped = await run(cycleCheckpoint, { plan: "plans/keep.md", decision: "loop", summary: "batch 1" });
		expect(looped.lap).toBe(2);
		expect(looped.remaining).toBe(2);
		expect(looped.instructions).toContain("i3");
		expect(looped.instructions).toContain("i4");
		const prog = itemsSidecar("keep");
		expect(prog.items).toEqual(["i1", "i2", "i3", "i4"]); // queue survived, not wiped to a narrow record
		expect(prog.cursor).toBe(2);
		expect(prog.batchStart).toBe(2);
		expect(prog.batchEnd).toBe(4);
	});

	it("drains on the final loop and prompts append-or-done, keeping the sidecar", async () => {
		await startItems({ name: "drain", cycle: "demo", spec: "x", items: ["only"] });
		await runBatchSteps("drain");
		const drained = await run(cycleCheckpoint, { plan: "plans/drain.md", decision: "loop", summary: "last" });
		expect(drained.drained).toBe(true);
		expect(drained.remaining).toBe(0);
		// Drained keeps the sidecar (an append could continue it); it is not auto-deleted.
		expect(fs.existsSync(path.join(cwd, "plans", "drain.cycle.json"))).toBe(true);
		// The window is normalized to the end, so a cold-resume status reads consistently.
		const st = await run(cycleStatus, { plan: "plans/drain.md" });
		expect(st.initialized).toBe(true);
		expect(st.remaining).toBe(0);
		expect(st.currentBatch).toEqual([]);
		expect(st.cursor).toBe(1);
	});

	it("processes a partial final batch before draining (no item lost)", async () => {
		await startItems({
			name: "five",
			cycle: "demo",
			spec: "x",
			items: ["i1", "i2", "i3", "i4", "i5"],
			batchSize: 2,
		});
		await runBatchSteps("five"); // batch [0,2)
		let cp = await run(cycleCheckpoint, { plan: "plans/five.md", decision: "loop", summary: "b1" });
		expect(cp.remaining).toBe(3);
		expect(itemsSidecar("five").batchEnd).toBe(4); // [2,4)
		await runBatchSteps("five"); // batch [2,4)
		cp = await run(cycleCheckpoint, { plan: "plans/five.md", decision: "loop", summary: "b2" });
		expect(cp.remaining).toBe(1);
		expect(itemsSidecar("five").batchStart).toBe(4);
		expect(itemsSidecar("five").batchEnd).toBe(5); // partial final [4,5)
		await runBatchSteps("five"); // batch [4,5)
		cp = await run(cycleCheckpoint, { plan: "plans/five.md", decision: "loop", summary: "b3" });
		expect(cp.drained).toBe(true); // i5 processed, now drained
		expect(cp.remaining).toBe(0);
	});

	it("batchSize override on loop changes the next batch width", async () => {
		await startItems({
			name: "bs",
			cycle: "demo",
			spec: "x",
			items: ["i1", "i2", "i3", "i4"],
			batchSize: 2,
		});
		await runBatchSteps("bs");
		await run(cycleCheckpoint, { plan: "plans/bs.md", decision: "loop", summary: "s", batchSize: 1 });
		const prog = itemsSidecar("bs");
		expect(prog.batchSize).toBe(1);
		expect(prog.batchStart).toBe(2);
		expect(prog.batchEnd).toBe(3); // min(2+1, 4)
	});

	it("re-injects spec + batch context on each step (mid-batch grounding)", async () => {
		await startItems({
			name: "inj",
			cycle: "demo",
			spec: "do the thing",
			items: ["i1", "i2"],
			batchSize: 2,
		});
		const stepB = await run(cycleNext, { plan: "plans/inj.md", completed: "a" });
		expect(stepB.step).toBe("b");
		expect(stepB.instructions).toContain("do the thing");
		expect(stepB.instructions).toContain("i1");
		expect(stepB.instructions).toContain("i2");
	});

	it("cycleStatus surfaces the queue for a cold resume", async () => {
		await startItems({
			name: "stat",
			cycle: "demo",
			spec: "do x",
			items: ["i1", "i2", "i3"],
			batchSize: 2,
		});
		const st = await run(cycleStatus, { plan: "plans/stat.md" });
		expect(st.mode).toBe("items");
		expect(st.spec).toBe("do x");
		expect(st.totalItems).toBe(3);
		expect(st.remaining).toBe(3);
		expect(st.currentBatch).toEqual(["i1", "i2"]);
	});

	it("cycleAppendItems feeds a drained run, which then resumes through the new items", async () => {
		await startItems({ name: "feed", cycle: "demo", spec: "x", items: ["i1"] });
		await runBatchSteps("feed");
		const drained = await run(cycleCheckpoint, { plan: "plans/feed.md", decision: "loop", summary: "b1" });
		expect(drained.drained).toBe(true);
		const app = await run(cycleAppendItems, { name: "feed", items: ["i2", "i3"] });
		expect(app.added).toBe(2);
		expect(app.totalItems).toBe(3);
		const looped = await run(cycleCheckpoint, { plan: "plans/feed.md", decision: "loop", summary: "after append" });
		expect(looped.drained).toBeUndefined(); // resumed, not drained
		expect(looped.remaining).toBe(2);
		expect(itemsSidecar("feed").batchStart).toBe(1);
		expect(itemsSidecar("feed").batchEnd).toBe(2);
	});

	it("skip records the item, and noDup drops queued items but re-allows a skipped one", async () => {
		await startItems({ name: "skip", cycle: "demo", spec: "x", items: ["a", "b", "c"], batchSize: 1 });
		await runBatchSteps("skip"); // batch [0,1) = "a"
		await run(cycleCheckpoint, { plan: "plans/skip.md", decision: "loop", summary: "skip a", skip: [0] });
		expect(itemsSidecar("skip").skipped).toEqual([0]);
		// "a" (index 0) is skipped so it may be re-added; "b" (index 1, not skipped) is dropped; "d" is new.
		const app = await run(cycleAppendItems, { name: "skip", items: ["a", "b", "d"], noDup: true });
		expect(app.added).toBe(2);
		expect(app.dropped).toBe(1);
		expect(itemsSidecar("skip").items).toEqual(["a", "b", "c", "a", "d"]);
	});

	it("cycleAppendItems errors on a missing or plan-mode run", async () => {
		await startItems({ name: "real", cycle: "demo", spec: "x", items: ["i1"] }); // creates plans/
		await expect(run(cycleAppendItems, { name: "nope", items: ["x"] })).rejects.toThrow("no items run");
		await startPlan({ plan: "plans/pm.md", cycle: "demo" });
		await expect(run(cycleAppendItems, { name: "pm", items: ["x"] })).rejects.toThrow("not an items queue");
	});

	it("a cold resume replays the exact in-flight batch window", async () => {
		await startItems({
			name: "resume",
			cycle: "demo",
			spec: "x",
			items: ["i1", "i2", "i3", "i4"],
			batchSize: 2,
		});
		await runBatchSteps("resume"); // batch [0,2)
		await run(cycleCheckpoint, { plan: "plans/resume.md", decision: "loop", summary: "b1" }); // -> [2,4)
		// Fresh read (cold resume) reads the persisted window, not a recomputed one.
		const st = await run(cycleStatus, { plan: "plans/resume.md" });
		expect(st.currentBatch).toEqual(["i3", "i4"]);
		expect(st.cursor).toBe(2);
		await run(cycleGoto, { plan: "plans/resume.md", step: "a" });
		expect(itemsSidecar("resume").batchStart).toBe(2);
		expect(itemsSidecar("resume").batchEnd).toBe(4);
	});

	it("skip is clamped to the current batch and merges across checkpoints", async () => {
		await startItems({ name: "sk", cycle: "demo", spec: "x", items: ["i1", "i2", "i3"], batchSize: 1 });
		await runBatchSteps("sk"); // batch [0,1)
		await run(cycleCheckpoint, { plan: "plans/sk.md", decision: "loop", summary: "s", skip: [0] }); // -> [1,2)
		await runBatchSteps("sk");
		// skip [1] is in-batch (recorded); the out-of-batch 0 is dropped (already recorded last lap anyway).
		await run(cycleCheckpoint, { plan: "plans/sk.md", decision: "loop", summary: "s", skip: [1, 2] });
		expect(itemsSidecar("sk").skipped).toEqual([0, 1]); // merged + sorted; index 2 (future) clamped out
	});
});

describe("per-run step subset", () => {
	// The includeSteps entry point lands in a later phase; here we inject the subset directly to test
	// the runtime: every tool must advance over progress.steps, not the def's full list.
	const setSubset = (plan: string, steps: string[]) =>
		corruptSidecar(plan, (p) => {
			p.steps = steps;
		});

	it("cycleStatus total and advancement use the subset, not the full def", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" }); // def steps a,b,c
		setSubset("p.md", ["a", "c"]); // omit b
		expect((await run(cycleStatus, { plan: "p.md" })).total).toBe(2);
		// advancing from a skips the omitted b straight to c, then c is the last kept step -> lapEnd
		expect((await run(cycleNext, { plan: "p.md", completed: "a" })).step).toBe("c");
		expect((await run(cycleNext, { plan: "p.md", completed: "c" })).lapEnd).toBe(true);
	});

	it("cycleGoto to a skipped step auto-advances with a note", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		setSubset("p.md", ["a", "c"]); // b omitted
		const goto = await run(cycleGoto, { plan: "p.md", step: "b" });
		expect(goto.step).toBe("c"); // next kept step at/after b
		expect(goto.instructions).toContain("(auto-advanced from b)");
	});

	it("cycleGoto to a kept step is normal; an unknown step errors", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" });
		setSubset("p.md", ["a", "c"]);
		expect((await run(cycleGoto, { plan: "p.md", step: "a" })).step).toBe("a");
		await expect(run(cycleGoto, { plan: "p.md", step: "zzz" })).rejects.toThrow("no step");
	});

	it("checkpoint loop wraps to the subset's first step, not the def's", async () => {
		await startPlan({ plan: "p.md", cycle: "demo" }); // def [a,b,c]
		setSubset("p.md", ["b", "c"]); // subset[0]=b != def[0]=a
		await run(cycleGoto, { plan: "p.md", step: "b" }); // current=b, in subset
		await run(cycleNext, { plan: "p.md", completed: "b" });
		await run(cycleNext, { plan: "p.md", completed: "c" }); // lapEnd
		const looped = await run(cycleCheckpoint, { plan: "p.md", decision: "loop", summary: "lap" });
		expect(looped.step).toBe("b"); // wrapped to subset[0], not def[0]
		expect(looped.lap).toBe(2);
	});
});

describe("configurable steps (includeSteps)", () => {
	const planSidecar = (plan: string) =>
		JSON.parse(fs.readFileSync(path.join(cwd, plan.replace(/\.md$/, ".cycle.json")), "utf8"));

	it("bounces for confirmation when includeSteps is omitted, writing no sidecar", async () => {
		const r = await run(cycleStartPlan, { plan: "p.md", cycle: "demo" });
		expect(r.bounce).toBe("confirm-steps");
		expect(r.steps).toEqual(["a", "b", "c"]);
		expect(r.message).toContain("ask which steps to skip");
		expect(fs.existsSync(path.join(cwd, "p.cycle.json"))).toBe(false);
	});

	it('["all"] starts the full suite with no persisted subset', async () => {
		const r = await run(cycleStartPlan, { plan: "p.md", cycle: "demo", includeSteps: ["all"] });
		expect(r.step).toBe("a");
		expect(r.steps).toEqual(["a", "b", "c"]);
		expect("steps" in planSidecar("p.md")).toBe(false);
	});

	it("a valid subset starts at the kept first step, persists, and runs only kept steps", async () => {
		const r = await run(cycleStartPlan, { plan: "p.md", cycle: "demo", includeSteps: ["b", "c"] });
		expect(r.step).toBe("b"); // a omitted -> starts at b
		expect(r.steps).toEqual(["b", "c"]);
		expect(planSidecar("p.md").steps).toEqual(["b", "c"]);
		expect((await run(cycleNext, { plan: "p.md", completed: "b" })).step).toBe("c");
		expect((await run(cycleNext, { plan: "p.md", completed: "c" })).lapEnd).toBe(true);
	});

	it("canonicalizes case + def order, ignores listing order, dedups", async () => {
		const r = await run(cycleStartPlan, { plan: "p.md", cycle: "demo", includeSteps: ["C", "a", "a"] });
		expect(r.steps).toEqual(["a", "c"]); // def order, case-folded, deduped
	});

	it("unknown ids bounce with the valid list, rejecting the whole call", async () => {
		const r = await run(cycleStartPlan, { plan: "p.md", cycle: "demo", includeSteps: ["a", "zzz"] });
		expect(r.bounce).toBe("unknown-steps");
		expect(r.unknownSteps).toEqual(["zzz"]);
		expect(r.message).toContain("a, b, c");
		expect(fs.existsSync(path.join(cwd, "p.cycle.json"))).toBe(false);
	});

	it("includeSteps also gates cycleStartItems (bounce before any fs)", async () => {
		const r = await run(cycleStartItems, { name: "it", cycle: "demo", spec: "x", items: ["i1"] });
		expect(r.bounce).toBe("confirm-steps");
		expect(fs.existsSync(path.join(cwd, "plans"))).toBe(false); // mkdir not reached on a bounce
	});

	it("an empty includeSteps array also bounces for confirmation", async () => {
		const r = await run(cycleStartPlan, { plan: "p.md", cycle: "demo", includeSteps: [] });
		expect(r.bounce).toBe("confirm-steps");
	});

	it("naming every step (not 'all') runs the full suite with no persisted subset", async () => {
		const r = await run(cycleStartPlan, { plan: "p.md", cycle: "demo", includeSteps: ["c", "b", "a"] });
		expect(r.steps).toEqual(["a", "b", "c"]); // def order
		expect("steps" in planSidecar("p.md")).toBe(false); // length == def -> no persist
	});

	it("includeSteps composes with items mode (subset drives the per-batch steps)", async () => {
		const r = await run(cycleStartItems, {
			name: "is",
			cycle: "demo",
			spec: "x",
			items: ["i1", "i2"],
			batchSize: 2,
			includeSteps: ["b", "c"],
		});
		expect(r.step).toBe("b"); // subset[0]
		expect(r.steps).toEqual(["b", "c"]);
		const sc = JSON.parse(fs.readFileSync(path.join(cwd, "plans", "is.cycle.json"), "utf8"));
		expect(sc.mode).toBe("items");
		expect(sc.steps).toEqual(["b", "c"]);
		expect((await run(cycleNext, { plan: "plans/is.md", completed: "b" })).step).toBe("c");
		expect((await run(cycleNext, { plan: "plans/is.md", completed: "c" })).lapEnd).toBe(true);
	});
});

describe("plan-mode phases (mode: phases)", () => {
	const writePlan = (rel: string, body: string) => {
		const p = path.join(cwd, rel);
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, body);
	};
	const sidecar = (rel: string) =>
		JSON.parse(fs.readFileSync(path.join(cwd, rel.replace(/\.md$/, ".cycle.json")), "utf8"));

	it("persists each phase's section body and injects the first phase", async () => {
		writePlan("roadmap.md", "# Roadmap\n\n## Phase one\nBuild the schema.\n\n## Phase two\nAdd the tools.\n");
		const r = await run(cycleStartPlan, {
			plan: "roadmap.md",
			cycle: "demo",
			includeSteps: ["all"],
			phases: ["Phase one", "Phase two"],
		});
		expect(r.step).toBe("a");
		expect(r.instructions).toContain("Build the schema."); // first phase body injected, not a pointer
		const sc = sidecar("roadmap.md");
		expect(sc.mode).toBe("phases");
		expect(sc.planPath).toBe("roadmap.md");
		expect(sc.items).toHaveLength(2);
		expect(sc.items[0]).toContain("Build the schema.");
		expect(sc.batchSize).toBe(1);
	});

	it("errors when a phase label has no matching ## header, listing the available headers", async () => {
		writePlan("r2.md", "## Alpha\nA.\n## Beta\nB.\n");
		await expect(
			run(cycleStartPlan, { plan: "r2.md", cycle: "demo", includeSteps: ["all"], phases: ["Alpha", "Nope"] }),
		).rejects.toThrow("not found");
	});

	it("errors when the plan file does not exist", async () => {
		await expect(
			run(cycleStartPlan, { plan: "ghost.md", cycle: "demo", includeSteps: ["all"], phases: ["x"] }),
		).rejects.toThrow("to exist");
	});

	it("validates phases before the step bounce (composition precedence)", async () => {
		writePlan("comp.md", "## Real\nbody.\n");
		// Bogus phase + absent includeSteps: errors on phases, does NOT bounce for step selection.
		await expect(run(cycleStartPlan, { plan: "comp.md", cycle: "demo", phases: ["Nope"] })).rejects.toThrow(
			"not found",
		);
	});

	it("composes a step subset with phases (kept steps per phase, subset[0] on phase wrap)", async () => {
		writePlan("ph-sub.md", "## A\nAlpha body.\n## B\nBeta body.\n");
		const r = await run(cycleStartPlan, {
			plan: "ph-sub.md",
			cycle: "demo",
			phases: ["A", "B"],
			includeSteps: ["a", "c"],
		});
		expect(r.step).toBe("a");
		expect(r.steps).toEqual(["a", "c"]);
		const sc = sidecar("ph-sub.md");
		expect(sc.mode).toBe("phases");
		expect(sc.steps).toEqual(["a", "c"]);
		expect(sc.items).toHaveLength(2);
		expect((await run(cycleNext, { plan: "ph-sub.md", completed: "a" })).step).toBe("c"); // b skipped
		expect((await run(cycleNext, { plan: "ph-sub.md", completed: "c" })).lapEnd).toBe(true);
		const looped = await run(cycleCheckpoint, { plan: "ph-sub.md", decision: "loop", summary: "phase A" });
		expect(looped.step).toBe("a"); // wrap to subset[0]
		expect(looped.instructions).toContain("Beta body."); // phase B injected
	});

	it("status surfaces phases mode; loop advances to the next phase with its body", async () => {
		writePlan("p3.md", "## One\nFirst.\n## Two\nSecond.\n");
		await run(cycleStartPlan, { plan: "p3.md", cycle: "demo", includeSteps: ["all"], phases: ["One", "Two"] });
		const st = await run(cycleStatus, { plan: "p3.md" });
		expect(st.mode).toBe("phases");
		expect(st.totalItems).toBe(2);
		expect(st.currentBatch[0]).toContain("First.");
		await run(cycleNext, { plan: "p3.md", completed: "a" });
		await run(cycleNext, { plan: "p3.md", completed: "b" });
		await run(cycleNext, { plan: "p3.md", completed: "c" });
		const looped = await run(cycleCheckpoint, { plan: "p3.md", decision: "loop", summary: "phase 1" });
		expect(looped.instructions).toContain("Second."); // second phase injected
		expect(looped.nextAction).toContain("phase");
	});

	it("cycleAppendItems rejects a phases run", async () => {
		writePlan("plans/p4.md", "## X\nx.\n");
		await run(cycleStartPlan, { plan: "plans/p4.md", cycle: "demo", includeSteps: ["all"], phases: ["X"] });
		await expect(run(cycleAppendItems, { name: "p4", items: ["y"] })).rejects.toThrow("not an items queue");
	});

	it("ignores a batchSize override on a phases run (one phase per lap, none dropped)", async () => {
		writePlan("bsp.md", "## P1\nOne.\n## P2\nTwo.\n## P3\nThree.\n");
		await run(cycleStartPlan, { plan: "bsp.md", cycle: "demo", includeSteps: ["all"], phases: ["P1", "P2", "P3"] });
		const loopPhase = async () => {
			await run(cycleNext, { plan: "bsp.md", completed: "a" });
			await run(cycleNext, { plan: "bsp.md", completed: "b" });
			await run(cycleNext, { plan: "bsp.md", completed: "c" });
			return run(cycleCheckpoint, { plan: "bsp.md", decision: "loop", summary: "p", batchSize: 5 }); // try to widen
		};
		const l1 = await loopPhase();
		expect(l1.instructions).toContain("Two."); // advanced exactly one phase
		expect(sidecar("bsp.md").batchEnd).toBe(2); // window stays 1-wide despite batchSize:5
		expect((await loopPhase()).instructions).toContain("Three."); // phase 3 NOT skipped
		expect((await loopPhase()).drained).toBe(true);
	});

	it("drains after the last phase (no append suggestion); done deletes the sidecar", async () => {
		writePlan("dn.md", "## Only\nThe only phase.\n");
		await run(cycleStartPlan, { plan: "dn.md", cycle: "demo", includeSteps: ["all"], phases: ["Only"] });
		await run(cycleNext, { plan: "dn.md", completed: "a" });
		await run(cycleNext, { plan: "dn.md", completed: "b" });
		await run(cycleNext, { plan: "dn.md", completed: "c" });
		const drained = await run(cycleCheckpoint, { plan: "dn.md", decision: "loop", summary: "p" });
		expect(drained.drained).toBe(true);
		expect(drained.instructions).toContain("phases done");
		expect(drained.nextAction).not.toContain("cycleAppendItems");
		await run(cycleCheckpoint, { plan: "dn.md", decision: "done", summary: "all done" });
		expect(fs.existsSync(path.join(cwd, "dn.cycle.json"))).toBe(false);
	});
});

describe("shipped cycle definitions", () => {
	it("audited-implementation loads with the compliance step (frontmatter matches its section)", async () => {
		// Use the real cycles/ dir (the suite otherwise points NYAASKILLS_CYCLES_DIR at a temp dir).
		const saved = process.env.NYAASKILLS_CYCLES_DIR;
		delete process.env.NYAASKILLS_CYCLES_DIR;
		try {
			const { loadCycleDef } = await import("../lib/resolveCycleDef.ts");
			const def = loadCycleDef("audited-implementation");
			expect(def.steps).toEqual(["implement", "align", "framework", "red-team", "compliance", "commit"]);
		} finally {
			if (saved !== undefined) process.env.NYAASKILLS_CYCLES_DIR = saved;
		}
	});
});

// Registration smoke test: mirrors what cycle-mcp.ts's registerTool loop requires of every tool, so
// a tool missing its `schema` field (which crashes the whole stdio server on startup) is caught here.
describe("toolsCycle registration shape", () => {
	it("exports eight tools", () => {
		expect(toolsCycle).toHaveLength(8);
	});
	for (const tool of toolsCycle) {
		const t = tool as {
			name?: unknown;
			title?: unknown;
			description?: unknown;
			schema?: { shape?: unknown };
			handler?: unknown;
		};
		it(`"${String(t.name)}" has the fields registerTool needs`, () => {
			expect(typeof t.name).toBe("string");
			expect(typeof t.title).toBe("string");
			expect(typeof t.description).toBe("string");
			expect(typeof t.handler).toBe("function");
			// The exact access cycle-mcp.ts does (tool.schema.shape); undefined schema throws here.
			expect(t.schema).toBeDefined();
			expect(typeof t.schema?.shape).toBe("object");
		});
	}
});
