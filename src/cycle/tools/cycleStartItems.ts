import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
	appendStepCall,
	cyclePreamble,
	itemsContext,
	readPlanFile,
	resolveDef,
	resolveSteps,
	StepBounceSchema,
	type StoredProgress,
	writeProgress,
} from "../lib/run.ts";

const schema = z.object({
	name: z
		.string()
		.regex(/^[A-Za-z0-9_-]+$/, "name must be a bare slug (letters, digits, _ or -)")
		.max(200, "name too long")
		.describe(
			`
A short slug naming this run. The queue + spec live in ./plans/<name>.cycle.json; advance and resume by passing plan: "plans/<name>.md". Shares a namespace with plan-mode runs on plans/<name>.md.
`.trim(),
		),
	cycle: z.string().describe(
		`
Name of the cycle definition to run over each batch (a *.md in the nyaaskills cycles library).
`.trim(),
	),
	spec: z
		.string()
		.min(1)
		.describe(
			`
The per-item task, applied to every batch (e.g. "Add a license header to each file"). Persisted in the sidecar and re-injected into every step so it survives compaction; do not rely on memory to carry it.
`.trim(),
		),
	items: z
		.array(z.string().min(1))
		.min(1)
		.describe(
			`
The ordered work queue (e.g. file paths from a find). Processed one batch per lap.
`.trim(),
		),
	batchSize: z
		.number()
		.int()
		.positive()
		.optional()
		.default(1)
		.describe(
			`
How many items to hand over per batch. Default 1. Keep small for heavy per-item work; larger suits uniform mechanical edits.
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
	name: z.string(),
	plan: z.string(),
	cycle: z.string(),
	step: z.string(),
	index: z.number(),
	total: z.number(),
	lap: z.number(),
	status: z.string(),
	steps: z.array(z.string()),
	totalItems: z.number(),
	batchSize: z.number(),
	instructions: z.string(),
});

export const cycleStartItems = {
	name: "cycleStartItems",
	title: "cycle-start-items",
	description: `
Initialize a cycle over an explicit work queue (items mode). Unlike \`cycleStartPlan(...)\`, the spec and the ordered item list live in the sidecar, and the tool tracks progress item by item so a long job survives compaction and full restarts. Runs the named cycle definition once per batch of items. Resume or advance by passing plan: "plans/<name>.md" to the other cycle tools. The sidecar plans/<name>.cycle.json is shared with a plan-mode run on plans/<name>.md; a non-active run under the same name is overwritten.

This may return a step-selection bounce instead of a started cycle: if the result has a \`bounce\` field, stop, show its \`message\` to the user, and re-call with the chosen \`includeSteps\` (or \`["all"]\` for the full suite). Do not treat the cycle as started on a bounce.
`.trim(),
	operation: "starting an items cycle",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { name, cycle, spec, items, batchSize, includeSteps } = schema.parse(args);

		const { def, instructions } = resolveDef(cycle);
		// Resolve the step selection before touching the filesystem: a bounce writes nothing.
		const resolution = resolveSteps(cycle, def.steps, includeSteps);
		if ("bounce" in resolution) return { data: StepBounceSchema.parse(resolution.bounce) };
		const steps = resolution.steps;

		// The sidecar lives at plans/<name>.cycle.json; resolvePlanPath (via readPlanFile) requires the
		// parent dir, so ensure plans/ exists. The synthetic plan path reuses all the existing
		// path-safety, read, and write machinery; the .md itself need not exist.
		fs.mkdirSync(path.resolve(cwd, "plans"), { recursive: true });
		const plan = `plans/${name}.md`;
		const planFile = readPlanFile(cwd, plan);
		if (planFile.progress?.status === "active") {
			throw new Error(
				`items run "${name}" already active (lap ${planFile.progress.lap}). Pick a new name or finish it first.`,
			);
		}
		if (planFile.malformed) {
			throw new Error(`a malformed cycle sidecar already exists for "${name}"; pick a new name or remove it.`);
		}

		const progress: StoredProgress = {
			mode: "items",
			name: cycle,
			current: steps[0],
			index: 0,
			lap: 1,
			status: "active",
			spec,
			items,
			cursor: 0,
			batchStart: 0,
			batchEnd: Math.min(batchSize, items.length),
			batchSize,
			skipped: [],
			...(steps.length < def.steps.length ? { steps } : {}),
		};
		writeProgress(planFile, progress);

		const result = {
			name,
			plan,
			cycle,
			step: steps[0],
			index: 0,
			total: steps.length,
			lap: 1,
			status: "active",
			steps,
			totalItems: items.length,
			batchSize,
			instructions: `${cyclePreamble(cycle)}\n\n${itemsContext(progress)}\n\n---\n\n${appendStepCall(instructions(steps[0]), plan, steps[0])}`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
