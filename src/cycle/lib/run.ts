import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { writeFileAtomic } from "./atomicWrite.ts";
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
};

// Plan mode: the spec is the plan .md the agent edits; no work queue in the sidecar.
const PlanProgress = z.object({ ...baseProgressFields, mode: z.literal("plan") });

// Items mode: the spec and the ordered work queue live in the sidecar. The items fields are a
// co-required group (all present together) so a half-written record fails validation instead of
// running half-configured. `cursor` is the next unprocessed index; [batchStart, batchEnd) is the
// in-flight batch (persisted so an interrupted batch resumes to the exact same window, which cursor
// plus a mutable batchSize cannot reconstruct); `skipped` records items disposed without doing.
const ItemsProgress = z.object({
	...baseProgressFields,
	mode: z.literal("items"),
	spec: z.string().min(1),
	items: z.array(z.string()),
	cursor: z.number().int().nonnegative(),
	batchStart: z.number().int().nonnegative(),
	batchEnd: z.number().int().nonnegative(),
	batchSize: z.number().int().positive(),
	skipped: z.array(z.number().int().nonnegative()),
});

// Sidecars written before items mode (and any hand-rolled one) carry no `mode`; default them to plan
// mode so existing runs keep parsing while the discriminant stays required for new records.
export const ProgressSchema = z.preprocess(
	(raw) => (raw && typeof raw === "object" && !("mode" in raw) ? { ...raw, mode: "plan" } : raw),
	z.discriminatedUnion("mode", [PlanProgress, ItemsProgress]),
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
	let sidecarMtimeMs: number | undefined;
	if (fs.existsSync(sidecarPath)) {
		sidecarMtimeMs = fs.statSync(sidecarPath).mtimeMs;
		try {
			const parsed = ProgressSchema.safeParse(JSON.parse(fs.readFileSync(sidecarPath, "utf8")));
			if (parsed.success) progress = parsed.data;
			else malformed = true;
		} catch {
			malformed = true;
		}
	}

	return { planPath, sidecarPath, sidecarMtimeMs, progress, malformed };
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
	if (!planFile.progress)
		throw new Error("no cycle on this plan; call `cycleStartPlan(...)` or `cycleStartItems(...)` first");
	const progress = planFile.progress;
	if (opts.requireActive && progress.status !== "active") {
		throw new Error(`cycle is ${progress.status}; reopen it with \`cycleGoto(...)\` before continuing`);
	}
	const { def, instructions } = resolveDef(progress.name);
	return { planFile, progress, def, steps: def.steps, instructions };
}

// The literal next call travels with the instructions so it stays in the agent's working context.
export function appendStepCall(instructions: string, plan: string, step: string): string {
	return `${instructions}\n\n>> When this step's work is done, call \`cycleNext({ plan: "${plan}", completed: "${step}" })\` to conclude it and move to the next step. This is normal forward progress; do not use \`cycleGoto(...)\` to advance.`;
}

export function checkpointCall(plan: string): string {
	return `All steps complete. Call \`cycleCheckpoint({ plan: "${plan}", decision, summary })\`: \`loop\` to continue straight into the next phase (the default - do not stop to ask between phases), \`done\` only when all the work is genuinely complete, or \`critical-stop\` only for a real blocker that needs a human.`;
}

// Prepended to the first step's instructions at start, so the agent knows it is inside a paced,
// repeating step-runner and should work one step at a time instead of doing the whole plan up front.
// The definition supplies any domain framing (e.g. "one lap = one phase"); this stays generic.
export function cyclePreamble(cycleName: string): string {
	return [
		`**Cycle \`${cycleName}\`** - a repeating step-runner that paces you through fixed steps.`,
		`Do only the current step's work, then call \`cycleNext(...)\`. After the last step,`,
		`\`cycleCheckpoint(...)\` decides: \`loop\` (run the steps again) or \`done\` (finished).`,
		`Work one step at a time as written; do not run ahead and do the whole plan at once.`,
	].join(" ");
}

// The spec and current batch, re-injected into items-mode instructions so the agent stays grounded
// each step without leaning on conversation memory (which compaction erases). Empty for plan mode.
export function itemsContext(progress: StoredProgress): string {
	if (progress.mode !== "items") return "";
	const { spec, items, batchStart, batchEnd } = progress;
	const list = items
		.slice(batchStart, batchEnd)
		.map((item, i) => `  ${batchStart + i + 1}. ${item}`)
		.join("\n");
	return [
		`Spec: ${spec}`,
		`Current batch - items ${batchStart + 1}-${batchEnd} of ${items.length}:`,
		list,
		"Apply the spec to only this batch's items. Conclude each step with `cycleNext(...)`; `cycleCheckpoint(...)` advances to the next batch.",
	].join("\n");
}

// Canonical form for noDup comparison: trim plus strip trailing slashes. Items are treated as opaque
// strings (often paths), so this is the documented identity rather than full path resolution.
export function normalizeItem(s: string): string {
	return s.trim().replace(/\/+$/, "");
}

export interface AppendResult {
	items: string[];
	added: number;
	dropped: number;
}

// Append to the queue. With noDup, drop any incoming item whose normalized form already exists among
// the NON-skipped queue items (so a deliberately re-queued skipped item is allowed through), and dedup
// the incoming batch against itself. Returns the new queue plus added/dropped counts.
export function appendItems(existing: string[], skipped: number[], newItems: string[], noDup: boolean): AppendResult {
	if (!noDup) return { items: [...existing, ...newItems], added: newItems.length, dropped: 0 };
	const skippedSet = new Set(skipped);
	const seen = new Set(existing.filter((_, i) => !skippedSet.has(i)).map(normalizeItem));
	const items = [...existing];
	let added = 0;
	let dropped = 0;
	for (const item of newItems) {
		const n = normalizeItem(item);
		if (seen.has(n)) {
			dropped++;
			continue;
		}
		seen.add(n);
		items.push(item);
		added++;
	}
	return { items, added, dropped };
}
