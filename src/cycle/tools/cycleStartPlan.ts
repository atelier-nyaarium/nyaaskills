import fs from "node:fs";
import { z } from "zod";
import { extractSections, normalizeHeader } from "../lib/extractSection.ts";
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

// Validate phase labels against the plan's ## headers and return each phase as "<label>\n\n<body>".
// Throws on a missing plan file or any unmatched label. Run BEFORE the step bounce so a run with bogus
// phases errors rather than prompting the user to pick steps.
function extractPhaseItems(planPath: string, plan: string, phases: string[]): string[] {
	if (!fs.existsSync(planPath)) {
		throw new Error(`phases mode needs the plan file "${plan}" to exist (it carries the phase sections).`);
	}
	const sections = extractSections(fs.readFileSync(planPath, "utf8"));
	const unmatched: string[] = [];
	const items: string[] = [];
	for (const label of phases) {
		const body = sections.get(normalizeHeader(label));
		if (body === undefined) unmatched.push(label);
		else items.push(`${label}\n\n${body}`);
	}
	if (unmatched.length > 0) {
		const available = [...sections.keys()].join(", ") || "(none)";
		throw new Error(
			`phase(s) not found as ## headers in "${plan}": ${unmatched.join(", ")}. Available: ${available}.`,
		);
	}
	return items;
}

// Construct a phases-mode record from validated phase items. Each item is a phase's plan section, so a
// cold resume injects real detail; batchSize 1 = one phase per lap; planPath keeps status honest.
function buildPhasesRecord(plan: string, cycle: string, items: string[], steps: string[]): StoredProgress {
	return {
		mode: "phases",
		name: cycle,
		current: steps[0],
		index: 0,
		lap: 1,
		status: "active",
		planPath: plan,
		spec: `Implement the plan at \`${plan}\` one phase at a time. The current phase's detail is shown below; do its work for each step.`,
		items,
		cursor: 0,
		batchStart: 0,
		batchEnd: 1,
		batchSize: 1,
		skipped: [],
		steps,
	};
}

const schema = z.object({
	plan: z.string().describe(
		`
Path to the plan file, relative to the project root.
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
Steps to run, by name; the rest are skipped. If you aren't sure what the user wants, call without includeSteps: the result carries the step menu to put in front of the user. Pass ["all"] only when the user explicitly wants the full suite.
`.trim(),
		),
	phases: z
		.array(z.string())
		.min(1)
		.optional()
		.describe(
			`
Track the plan's phases for crash recovery. Each label must match a ## header in the plan file; one phase runs per lap and its detail is re-shown each step. Omit for a freeform plan run. The plan file must exist.
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
Start a cycle on a plan file: you drive the plan .md and decide how to split the work into phases. Name a cycle definition to run; the first step's instructions come back.

When the user says something loose like "do cycles of implementation", this is the tool.

A result with a \`bounce\` field means the cycle did NOT start; follow the bounce's \`message\`.
`.trim(),
	operation: "starting a cycle",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan, cycle, force, includeSteps, phases } = schema.parse(args);

		const { def, instructions } = resolveDef(cycle);

		const planFile = readPlanFile(cwd, plan);
		// Protect an existing run (active, or corrupted-but-present) before overwriting it.
		if (!force) {
			if (planFile.progress?.status === "active") {
				throw new Error(
					`plan already running cycle "${planFile.progress.name}" (active, lap ${planFile.progress.lap}). Pass force:true to restart.`,
				);
			}
			if (planFile.malformed) {
				throw new Error(
					`plan has a malformed cycle sidecar (${planFile.malformedReason ?? "unreadable"}); fix the JSON or pass force:true to overwrite it.`,
				);
			}
		}

		// Composition precedence: validate phases first (hard error) so a run with bogus phases never
		// prompts for step selection. The step bounce (if any) follows; neither writes a sidecar.
		const phaseItems = phases ? extractPhaseItems(planFile.planPath, plan, phases) : undefined;

		const resolution = resolveSteps(cycle, def.steps, includeSteps);
		if ("bounce" in resolution) return { data: StepBounceSchema.parse(resolution.bounce) };
		const steps = resolution.steps;

		// `steps` is persisted even for a full-suite run, so the sidecar always shows the editable
		// knob: a human can trim this list mid-run to drop steps.
		const progress: StoredProgress = phaseItems
			? buildPhasesRecord(plan, cycle, phaseItems, steps)
			: { mode: "plan", name: cycle, current: steps[0], index: 0, lap: 1, status: "active", steps };
		writeProgress(planFile, progress);

		const ctx = itemsContext(progress); // the first phase's detail (empty for a freeform plan run)
		const result = {
			plan,
			cycle,
			step: steps[0],
			index: 0,
			total: steps.length,
			lap: 1,
			status: "active",
			steps,
			instructions: `${cyclePreamble(cycle)}\n\n${ctx ? `${ctx}\n\n` : ""}---\n\n${appendStepCall(instructions(steps[0]), plan, steps[0])}`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
