import { z } from "zod";
import {
	appendStepCall,
	cyclePreamble,
	readPlanFile,
	resolveDef,
	resolveSteps,
	StepBounceSchema,
	type StoredProgress,
	writeProgress,
} from "../lib/run.ts";

const schema = z.object({
	plan: z.string().describe(
		`
Path to the plan file (relative to the project root) that carries cycle progress.
`.trim(),
	),
	cycle: z.string().describe(
		`
Name of the cycle definition to run (a *.md in the nyaaskills cycles library).
`.trim(),
	),
	force: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			`
Restart even if the plan file already has an active cycle.
`.trim(),
		),
	includeSteps: z
		.array(z.string())
		.optional()
		.describe(
			`
Steps to run by name (others are skipped). Omit to get a confirm-bounce listing the full step suite to show the user; pass ["all"] for the full suite; unknown ids bounce with the valid list.
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
	steps: z.array(z.string()),
	instructions: z.string(),
});

export const cycleStartPlan = {
	name: "cycleStartPlan",
	title: "cycle-start-plan",
	description: `
Initialize a controlled workflow cycle on a plan file (plan mode: the plan .md is the spec and you judge how to divide the work into phases). Loads the named cycle definition from the nyaaskills cycles library, validates it, writes the starting progress to a JSON sidecar next to the plan file, and returns the first step's instructions. For an explicit, tool-tracked work queue instead, use \`cycleStartItems(...)\`.

When the user says something loose like "do cycles of implementation", check this series of tools.

This may return a step-selection bounce instead of a started cycle: if the result has a \`bounce\` field, stop, show its \`message\` to the user, and re-call with the chosen \`includeSteps\` (or \`["all"]\` for the full suite). Do not treat the cycle as started or call \`cycleNext(...)\` on a bounce.
`.trim(),
	operation: "starting a cycle",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan, cycle, force, includeSteps } = schema.parse(args);

		const { def, instructions } = resolveDef(cycle);
		// Resolve the step selection first: a blank/unknown includeSteps bounces back for the user to
		// confirm, with zero side effects. Otherwise this is the effective per-run subset (def-order,
		// deduped); a strict subset is persisted, a full run is not.
		const resolution = resolveSteps(cycle, def.steps, includeSteps);
		if ("bounce" in resolution) return { data: StepBounceSchema.parse(resolution.bounce) };
		const steps = resolution.steps;

		const planFile = readPlanFile(cwd, plan);
		// Protect an existing run (active, or corrupted-but-present) before overwriting it.
		if (!force) {
			if (planFile.progress?.status === "active") {
				throw new Error(
					`plan already running cycle "${planFile.progress.name}" (active, lap ${planFile.progress.lap}). Pass force:true to restart.`,
				);
			}
			if (planFile.malformed) {
				throw new Error("plan has a malformed cycle block; pass force:true to overwrite it.");
			}
		}

		const progress: StoredProgress = {
			mode: "plan",
			name: cycle,
			current: steps[0],
			index: 0,
			lap: 1,
			status: "active",
			...(steps.length < def.steps.length ? { steps } : {}),
		};
		writeProgress(planFile, progress);

		const result = {
			plan,
			cycle,
			step: steps[0],
			index: 0,
			total: steps.length,
			lap: 1,
			status: "active",
			steps,
			instructions: `${cyclePreamble(cycle)}\n\n---\n\n${appendStepCall(instructions(steps[0]), plan, steps[0])}`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
