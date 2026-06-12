import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { writeFileAtomic } from "./atomicWrite.ts";
import { findStep } from "./computeNext.ts";
import { extractSection } from "./extractSection.ts";
import { type CycleDef, loadCycleDef } from "./resolveCycleDef.ts";
import { resolvePlanPath } from "./resolvePlanPath.ts";

// Cycle progress lives in a JSON sidecar next to the plan, NOT in the plan itself, so the tools
// never touch the document the author is editing (no file-write race against pending body edits).
const baseProgressFields = {
	name: z.string().min(1),
	current: z.string().min(1),
	index: z.number().int().nonnegative(),
	lap: z.number().int().positive(),
	status: z.enum(["active", "done", "stopped"]),
	summary: z.string().optional(),
	// The effective step sequence for this run (index is relative to this list). Named after the
	// start tools' includeSteps param and always persisted - even for a full-suite run - so a human
	// editing the sidecar mid-run has a visible, obvious knob for dropping steps. Still optional on
	// read for older sidecars (absent = the def's full step list).
	includeSteps: z.array(z.string().min(1)).min(1).optional(),
};

// Plan mode: the spec is the plan .md the agent edits; no work queue in the sidecar.
const PlanProgress = z.object({ ...baseProgressFields, mode: z.literal("plan") });

// The work-queue fields, shared by items mode and phases mode. A co-required group (all present
// together) so a half-written record fails validation. `cursor` is the next unprocessed index;
// [batchStart, batchEnd) is the in-flight batch (persisted so an interrupted batch resumes to the
// exact same window); `deferredItemIndexes` records queue positions set aside without doing.
const queueFields = {
	spec: z.string().min(1),
	items: z.array(z.string()),
	cursor: z.number().int().nonnegative(),
	batchStart: z.number().int().nonnegative(),
	batchEnd: z.number().int().nonnegative(),
	batchSize: z.number().int().positive(),
	deferredItemIndexes: z.array(z.number().int().nonnegative()),
};

// Items mode: an explicit work queue lives in the sidecar.
const ItemsProgress = z.object({ ...baseProgressFields, mode: z.literal("items"), ...queueFields });

// Phases mode: a plan run that tracks the plan's phases. Reuses the queue machinery (one phase per
// lap, batchSize 1) where `items` holds each phase's section body, plus `planPath` for addressing and
// honest status (a phases run must NOT masquerade as items mode).
const PhasesProgress = z.object({
	...baseProgressFields,
	mode: z.literal("phases"),
	planPath: z.string().min(1),
	...queueFields,
});

// Tolerate older sidecars: default the missing `mode` discriminant to plan mode, and map the
// pre-rename field names (`steps`, `skipped`) onto their positive successors.
export const ProgressSchema = z.preprocess(
	(raw) => {
		if (!raw || typeof raw !== "object") return raw;
		const r = { ...(raw as Record<string, unknown>) };
		if (!("mode" in r)) r.mode = "plan";
		if ("steps" in r && !("includeSteps" in r)) {
			r.includeSteps = r.steps;
			delete r.steps;
		}
		if ("skipped" in r && !("deferredItemIndexes" in r)) {
			r.deferredItemIndexes = r.skipped;
			delete r.skipped;
		}
		return r;
	},
	z.discriminatedUnion("mode", [PlanProgress, ItemsProgress, PhasesProgress]),
);

export type StoredProgress = z.infer<typeof ProgressSchema>;

// `plans/spring.md` -> `plans/spring.cycle.json`. A non-markdown plan keeps its name: `x.txt` ->
// `x.txt.cycle.json`.
export function sidecarPathFor(planPath: string): string {
	return `${planPath.replace(/\.(md|mdx|markdown)$/i, "")}.cycle.json`;
}

export interface PlanFile {
	planPath: string;
	sidecarPath: string;
	sidecarMtimeMs?: number;
	progress: StoredProgress | null;
	// True when the sidecar exists but is unreadable/invalid. Lets callers distinguish "corrupted
	// run" from "no run" so a single bad field cannot be silently overwritten.
	malformed: boolean;
	// What failed validation, so a hand-edit gone wrong is fixable without diffing the schema
	// (e.g. `deferredItemIndexes.0: expected number, received string`).
	malformedReason?: string;
}

// Read a plan file's progress sidecar (null when uninitialized/missing/malformed).
export function readPlanFile(cwd: string, plan: string): PlanFile {
	const planPath = resolvePlanPath(cwd, plan);
	const sidecarPath = sidecarPathFor(planPath);

	if (fs.existsSync(sidecarPath) && fs.lstatSync(sidecarPath).isSymbolicLink()) {
		throw new Error(`refusing to use a symlinked cycle sidecar: ${path.basename(sidecarPath)}`);
	}

	let progress: StoredProgress | null = null;
	let malformed = false;
	let malformedReason: string | undefined;
	let sidecarMtimeMs: number | undefined;
	if (fs.existsSync(sidecarPath)) {
		sidecarMtimeMs = fs.statSync(sidecarPath).mtimeMs;
		try {
			const parsed = ProgressSchema.safeParse(JSON.parse(fs.readFileSync(sidecarPath, "utf8")));
			if (parsed.success) progress = parsed.data;
			else {
				malformed = true;
				malformedReason = parsed.error.issues
					.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
					.join("; ");
			}
		} catch (error) {
			malformed = true;
			malformedReason = `not valid JSON: ${(error as Error).message}`;
		}
	}

	return { planPath, sidecarPath, sidecarMtimeMs, progress, malformed, malformedReason };
}

// Persist progress to the sidecar atomically. The mtime guard refuses the write if the sidecar
// changed since it was read.
export function writeProgress(planFile: PlanFile, progress: StoredProgress): void {
	writeFileAtomic(planFile.sidecarPath, `${JSON.stringify(progress, null, 2)}\n`, {
		expectedMtimeMs: planFile.sidecarMtimeMs,
	});
}

// Remove the progress sidecar. Used when a cycle finishes "done": the plan is fully consumed, so
// nothing should linger to resume, and a later cycleStartPlan starts clean without needing force.
export function deleteSidecar(planFile: PlanFile): void {
	if (fs.existsSync(planFile.sidecarPath)) fs.rmSync(planFile.sidecarPath);
}

// A start tool returns one of these instead of a started cycle when the step selection needs the
// human: either confirm the full suite, or fix unrecognized ids. The agent tests `bounce` to know it
// must stop and relay rather than treat the cycle as started.
export const StepBounceSchema = z.object({
	bounce: z.enum(["confirm-steps", "unknown-steps"]),
	cycle: z.string(),
	steps: z.array(z.string()),
	message: z.string(),
	unknownSteps: z.array(z.string()).optional(),
});
export type StepBounce = z.infer<typeof StepBounceSchema>;

// Resolve a start tool's includeSteps against the def's steps. Returns a bounce (stop + relay) or the
// effective subset to persist. Absent/empty -> confirm bounce; ["all"] -> full suite; any unknown id
// -> unknown bounce (whole call rejected); otherwise the def-filtered, deduped, canonical-order subset.
export function resolveSteps(
	cycle: string,
	defSteps: string[],
	includeSteps: string[] | undefined,
): { bounce: StepBounce } | { steps: string[] } {
	const menu = defSteps.map((s, i) => `${i + 1}. ${s}`).join(", ");
	if (includeSteps === undefined || includeSteps.length === 0) {
		return {
			bounce: {
				bounce: "confirm-steps",
				cycle,
				steps: defSteps,
				message: `Cycle "${cycle}" has these steps: ${menu}. Show this menu to the user and ask which steps to run or skip; do not choose for them. Then re-call with includeSteps set to the kept steps (["all"] if they want the full suite).`,
			},
		};
	}
	// Any "all" token means the full suite (forgiving: ["all"], or ["all", ...] also resolves to full).
	if (includeSteps.some((s) => s.trim().toLowerCase() === "all")) {
		return { steps: defSteps };
	}
	const matched = includeSteps.map((raw) => ({ raw, canonical: findStep(defSteps, raw) }));
	const unknown = matched.filter((m) => m.canonical === null).map((m) => m.raw);
	if (unknown.length > 0) {
		const recognized = matched.flatMap((m) => (m.canonical ? [m.canonical] : []));
		return {
			bounce: {
				bounce: "unknown-steps",
				cycle,
				steps: defSteps,
				unknownSteps: unknown,
				message: `Unrecognized step(s): ${unknown.join(", ")}. Recognized: ${recognized.join(", ") || "none"}. Valid steps are: ${defSteps.join(", ")}. Re-call with valid ids.`,
			},
		};
	}
	// All valid: filter the def (canonical order, dedup by construction).
	const kept = new Set(matched.map((m) => m.canonical));
	return { steps: defSteps.filter((s) => kept.has(s)) };
}

export interface ResolvedDef {
	def: CycleDef;
	instructions(step: string): string;
}

// Load the definition a plan is running and give a step -> instructions resolver.
export function resolveDef(name: string): ResolvedDef {
	const def = loadCycleDef(name);
	return { def, instructions: (step: string) => extractSection(def.body, step) };
}

export interface CycleRun {
	planFile: PlanFile;
	progress: StoredProgress;
	def: CycleDef;
	steps: string[];
	instructions(step: string): string;
}

// Single source of truth for "load a running cycle": the precondition bundle every stateful tool
// needs (plan file exists, has a cycle, optionally active) plus its resolved definition. Keeping it
// here means the tools cannot drift on what counts as runnable or on the error wording.
export function loadCycleRun(cwd: string, plan: string, opts: { requireActive: boolean }): CycleRun {
	const planFile = readPlanFile(cwd, plan);
	// A malformed sidecar is a live run with a bad edit, not a missing run; saying "no cycle" here
	// sends the agent off to restart and lose the state. Point at the file and the failing field.
	if (planFile.malformed) {
		throw new Error(
			`the cycle sidecar at ${planFile.sidecarPath} is malformed (${planFile.malformedReason ?? "unreadable"}). ` +
				`Fix that JSON by hand to resume, or restart the cycle with force:true.`,
		);
	}
	if (!planFile.progress)
		throw new Error("no cycle on this plan; call `cycleStartPlan(...)` or `cycleStartItems(...)` first");
	const progress = planFile.progress;
	if (opts.requireActive && progress.status !== "active") {
		throw new Error(`cycle is ${progress.status}; reopen it with \`cycleGoto(...)\` before continuing`);
	}
	const { def, instructions } = resolveDef(progress.name);
	// The effective sequence is the per-run subset if set, else the def's full list. Every stateful
	// tool advances over this, not def.steps, so a configured run runs only its kept steps.
	return { planFile, progress, def, steps: progress.includeSteps ?? def.steps, instructions };
}

// The literal next call travels with the instructions so it stays in the agent's working context.
export function appendStepCall(instructions: string, plan: string, step: string): string {
	return `${instructions}\n\n>> When this step's work is done, call \`cycleNext({ plan: "${plan}", completed: "${step}" })\` to conclude it and move to the next step. This is normal forward progress; do not use \`cycleGoto(...)\` to advance.`;
}

// The lapEnd return: the ONE place the loop/done/critical-stop decision is spelled out. cyclePreamble
// and itemsContext deliberately stay silent on it, so a first or intermediate step never carries bail
// mechanics; the decision surfaces only when the agent actually reaches the end of the lap.
export function checkpointCall(plan: string): string {
	return [
		`All steps complete. Call \`cycleCheckpoint({ plan: "${plan}", decision, summary })\` with a 1-2 sentence summary and one decision:`,
		"",
		"- `loop` - do another lap. This is the default; keep going, do not stop to ask between laps.",
		"- `done` - the work is complete, or another lap would add only minimal gains.",
		"- `critical-stop` - only for a real blocker that needs a human.",
	].join("\n");
}

// Prepended to the first step's instructions at start, so the agent works one step at a time instead
// of doing the whole plan up front. Stays generic and says nothing about ending the lap: the
// loop/done/critical-stop decision is surfaced only at lapEnd (see checkpointCall), so a first or
// intermediate step never carries bail mechanics.
export function cyclePreamble(cycleName: string): string {
	return [
		`**Cycle \`${cycleName}\`** - a step-runner that paces you through fixed steps, one at a time.`,
		`Do only the current step's work, then call \`cycleNext(...)\` to move on.`,
		`Do not run ahead and do the whole plan at once.`,
	].join(" ");
}

// The spec and current batch, re-injected into items-mode instructions so the agent stays grounded
// each step without leaning on conversation memory (which compaction erases). Empty for plan mode.
export function itemsContext(progress: StoredProgress): string {
	if (progress.mode === "plan") return "";
	const { spec, items, batchStart, batchEnd } = progress;
	if (progress.mode === "phases") {
		// One phase per lap; the item IS the phase's plan section, injected so a cold resume has the
		// real detail rather than a pointer to the plan file.
		return [`Spec: ${spec}`, `Current phase ${batchStart + 1} of ${items.length}:`, items[batchStart] ?? ""].join(
			"\n\n",
		);
	}
	const list = items
		.slice(batchStart, batchEnd)
		.map((item, i) => `  ${batchStart + i + 1}. ${item}`)
		.join("\n");
	return [
		`Spec: ${spec}`,
		`Current batch - items ${batchStart + 1}-${batchEnd} of ${items.length}:`,
		list,
		"Apply the spec to only this batch's items.",
	].join("\n");
}

// Canonical form for dedupe comparison: trim plus strip trailing slashes. Items are treated as opaque
// strings (often paths), so this is the documented identity rather than full path resolution.
export function normalizeItem(s: string): string {
	return s.trim().replace(/\/+$/, "");
}

export interface AppendResult {
	items: string[];
	added: number;
	duplicates: number;
}

// Append to the queue. With dedupe, an incoming item whose normalized form already exists among the
// active (non-deferred) queue items counts as a duplicate (so a deliberately re-queued deferred item
// is allowed through), and the incoming batch is deduped against itself. Returns the new queue plus
// added/duplicate counts.
export function appendItems(
	existing: string[],
	deferredIndexes: number[],
	newItems: string[],
	dedupe: boolean,
): AppendResult {
	if (!dedupe) return { items: [...existing, ...newItems], added: newItems.length, duplicates: 0 };
	const deferred = new Set(deferredIndexes);
	const seen = new Set(existing.filter((_, i) => !deferred.has(i)).map(normalizeItem));
	const items = [...existing];
	let added = 0;
	let duplicates = 0;
	for (const item of newItems) {
		const n = normalizeItem(item);
		if (seen.has(n)) {
			duplicates++;
			continue;
		}
		seen.add(n);
		items.push(item);
		added++;
	}
	return { items, added, duplicates };
}
