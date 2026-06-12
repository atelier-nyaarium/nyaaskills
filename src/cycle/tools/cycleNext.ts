import { z } from "zod";
import { advance, findStep } from "../lib/computeNext.ts";
import {
	appendStepCall,
	checkpointCall,
	itemsContext,
	loadCycleRun,
	type StoredProgress,
	writeProgress,
} from "../lib/run.ts";

const schema = z.object({
	plan: z.string().describe(
		`
Path to the plan file.
`.trim(),
	),
	completed: z
		.string()
		.optional()
		.describe(
			`
Name of the step you just finished. Must match the current step; concluding it is what advances the cycle.
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
	advanced: z.boolean(),
	lapEnd: z.boolean().optional(),
	needsResolution: z.boolean().optional(),
	suggested: z.string().optional(),
	instructions: z.string(),
	nextAction: z.string(),
});

export const cycleNext = {
	name: "cycleNext",
	title: "cycle-next",
	description: `
Conclude the step you just finished and advance to the next. Do the current step's work, then call this with \`completed\` set to that step's name. This is the normal way forward.
`.trim(),
	operation: "concluding a step",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan, completed } = schema.parse(args);
		const { planFile, progress, steps, instructions } = loadCycleRun(cwd, plan, { requireActive: true });
		const total = steps.length;
		const base = {
			plan,
			cycle: progress.name,
			total,
			lap: progress.lap,
			status: progress.status,
		};
		// In items/phases mode, re-inject the spec + current batch/phase on every step so a mid-batch
		// compaction cannot strand the agent without knowing what it is doing or to which items.
		const withContext = (text: string) =>
			progress.mode !== "plan" ? `${itemsContext(progress)}\n\n---\n\n${text}` : text;

		// Resolve the move first so a current step that vanished from the definition is detected
		// before we try to render its (now missing) instructions, regardless of `completed`.
		const move = advance(steps, progress.current, progress.index);
		if (move.kind === "needsResolution") {
			const result = {
				...base,
				step: progress.current,
				index: progress.index,
				advanced: false,
				needsResolution: true,
				suggested: move.suggested,
				instructions: `The step "${move.oldCurrent}" is no longer in cycle "${progress.name}". Steps are now: ${steps.join(", ")}.`,
				nextAction: `Call \`cycleGoto({ plan: "${plan}", step: "${move.suggested}" })\` to resume at a valid step.`,
			};
			return { data: OutputSchema.parse(result) };
		}

		// Confirm-then-advance: only a matching `completed` advances; otherwise report current
		// (safe now that current is known to be in the definition).
		const confirmed = completed !== undefined && findStep(steps, completed) === progress.current;
		if (!confirmed) {
			const result = {
				...base,
				step: progress.current,
				index: progress.index,
				advanced: false,
				instructions: withContext(instructions(progress.current)),
				nextAction: `Not advanced: pass \`completed: "${progress.current}"\` to conclude the current step. Do its work, then call \`cycleNext({ plan: "${plan}", completed: "${progress.current}" })\`. (\`cycleNext(...)\` is normal forward progress; you do not need \`cycleGoto(...)\`.)`,
			};
			return { data: OutputSchema.parse(result) };
		}

		if (move.kind === "lapEnd") {
			const result = {
				...base,
				step: progress.current,
				index: progress.index,
				advanced: false,
				lapEnd: true,
				instructions: checkpointCall(plan),
				nextAction: checkpointCall(plan),
			};
			return { data: OutputSchema.parse(result) };
		}

		const next: StoredProgress = { ...progress, current: move.current, index: move.index };
		writeProgress(planFile, next);
		const result = {
			...base,
			step: move.current,
			index: move.index,
			advanced: true,
			instructions: withContext(appendStepCall(instructions(move.current), plan, move.current)),
			nextAction: `Now do the work for step "${move.current}", then call \`cycleNext({ plan: "${plan}", completed: "${move.current}" })\` to conclude it and continue.`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
