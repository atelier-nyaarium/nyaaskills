import { z } from "zod";
import { findStep } from "../lib/computeNext.ts";
import { appendStepCall, loadCycleRun, type StoredProgress, writeProgress } from "../lib/run.ts";

const schema = z.object({
	plan: z.string().describe(
		`
Path to the plan file.
`.trim(),
	),
	step: z.string().describe(
		`
The step to jump to (matched case-insensitively against the definition).
`.trim(),
	),
	resetLap: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			`
Also reset the lap counter to 1.
`.trim(),
		),
});

const OutputSchema = z.object({
	plan: z.string(),
	cycle: z.string(),
	step: z.string(),
	index: z.number(),
	total: z.number(),
	lap: z.number(),
	status: z.string(),
	instructions: z.string(),
	nextAction: z.string(),
});

export const cycleGoto = {
	name: "cycleGoto",
	title: "cycle-goto",
	description: `
Jump to a named step when leaving the normal path: redo a step, skip ahead, or recover after needsResolution. This is NOT how you advance normally; for normal forward progress conclude each step with \`cycleNext(...)\` instead. Also reopens a done/stopped cycle by setting it active. Optionally resets the lap counter.
`.trim(),
	operation: "jumping to a step",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan, step, resetLap } = schema.parse(args);
		const { planFile, progress, def, instructions } = loadCycleRun(cwd, plan, { requireActive: false });
		const canonical = findStep(def.steps, step);
		if (!canonical) {
			throw new Error(`no step "${step}" in cycle "${progress.name}". Steps: ${def.steps.join(", ")}.`);
		}

		const next: StoredProgress = {
			...progress,
			current: canonical,
			index: def.steps.indexOf(canonical),
			status: "active",
			lap: resetLap ? 1 : progress.lap,
		};
		writeProgress(planFile, next);

		const result = {
			plan,
			cycle: progress.name,
			step: canonical,
			index: next.index,
			total: def.steps.length,
			lap: next.lap,
			status: "active",
			instructions: appendStepCall(instructions(canonical), plan, canonical),
			nextAction: `Resumed at step "${canonical}". Do the work, then call \`cycleNext({ plan: "${plan}", completed: "${canonical}" })\` to continue forward.`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
