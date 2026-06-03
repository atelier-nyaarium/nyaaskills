import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { writeFileAtomic } from "./atomicWrite.ts";
import { extractSection } from "./extractSection.ts";
import { type CycleDef, loadCycleDef } from "./resolveCycleDef.ts";
import { resolvePlanPath } from "./resolvePlanPath.ts";

// Cycle progress lives in a JSON sidecar next to the plan, NOT in the plan itself, so the tools
// never touch the document the author is editing (no file-write race against pending body edits).
export const ProgressSchema = z.object({
	name: z.string().min(1),
	current: z.string().min(1),
	index: z.number().int().nonnegative(),
	lap: z.number().int().positive(),
	status: z.enum(["active", "done", "stopped"]),
	summary: z.string().optional(),
});

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
// nothing should linger to resume, and a later cycleStart starts clean without needing force.
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
	if (!planFile.progress) throw new Error("no cycle on this plan; call `cycleStart(...)` first");
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
	return `All steps complete. Call \`cycleCheckpoint({ plan: "${plan}", decision, summary })\` with decision = "done" | "loop" | "critical-stop".`;
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
