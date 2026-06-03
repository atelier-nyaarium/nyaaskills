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
Jump to a named step when you are leaving the normal path: redo a step, skip ahead, or recover when the current step has vanished from the definition. This is NOT normal forward progress; to move forward, conclude each step with \`cycleNext(...)\`. Also reopens a done or stopped cycle. Optionally resets the lap counter.
`.trim(),
	operation: "jumping to a step",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan, step, resetLap } = schema.parse(args);
		const { planFile, progress, def, steps, instructions } = loadCycleRun(cwd, plan, { requireActive: false });

		// Resolve against the effective subset first. A target that is a real def step but was skipped
		// for this run auto-advances to the next kept step (rather than rejecting); a target not in the
		// def at all errors with the real step list.
		let landed = findStep(steps, step);
		let autoNote = "";
		if (!landed) {
			const inDef = findStep(def.steps, step);
			if (!inDef) {
				throw new Error(`no step "${step}" in cycle "${progress.name}". Steps: ${def.steps.join(", ")}.`);
			}
			// Land on the first kept step at or after the skipped one in DEF order (robust to a
			// mis-ordered subset), clamping to the def-latest kept step if none follows.
			const kept = new Set(steps);
			const defPos = def.steps.indexOf(inDef);
			landed =
				def.steps.slice(defPos).find((s) => kept.has(s)) ??
				[...def.steps].reverse().find((s) => kept.has(s)) ??
				steps[0];
			autoNote = `(auto-advanced from ${inDef})\n`;
		}

		const next: StoredProgress = {
			...progress,
			current: landed,
			index: steps.indexOf(landed),
			status: "active",
			lap: resetLap ? 1 : progress.lap,
		};
		writeProgress(planFile, next);

		const result = {
			plan,
			cycle: progress.name,
			step: landed,
			index: next.index,
			total: steps.length,
			lap: next.lap,
			status: "active",
			instructions: `${autoNote}${appendStepCall(instructions(landed), plan, landed)}`,
			nextAction: `Resumed at step "${landed}". Do the work, then call \`cycleNext({ plan: "${plan}", completed: "${landed}" })\` to continue forward.`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
