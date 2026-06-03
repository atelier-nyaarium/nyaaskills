import { z } from "zod";
import { applyLoop, type CycleProgress } from "../lib/computeNext.ts";
import { notifyCycleEnd } from "../lib/notify.ts";
import { appendStepCall, deleteSidecar, loadCycleRun, type StoredProgress, writeProgress } from "../lib/run.ts";

const schema = z.object({
	plan: z.string().describe(
		`
Path to the plan file.
`.trim(),
	),
	decision: z.enum(["done", "loop", "critical-stop"]).describe(
		`
End-of-lap decision.
`.trim(),
	),
	summary: z
		.string()
		.min(1)
		.describe(
			`
1-2 sentences: what this lap did and the outcome.
`.trim(),
		),
	acknowledgeOverrun: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			`
Required to loop past the cycle's maxLaps soft cap. Set this if you've found a critical reason to keep pushing.
`.trim(),
		),
});

const OutputSchema = z.object({
	plan: z.string(),
	cycle: z.string(),
	decision: z.string(),
	status: z.string(),
	lap: z.number(),
	step: z.string(),
	lapLimitReached: z.boolean().optional(),
	instructions: z.string(),
	nextAction: z.string(),
});

export const cycleCheckpoint = {
	name: "cycleCheckpoint",
	title: "cycle-checkpoint",
	description: `
Make the end-of-lap decision after the last step: done | loop | critical-stop, with a 1-2 sentence summary.
- \`loop\` wraps to the first step and bumps the lap (refused past the maxLaps soft cap unless acknowledgeOverrun is set)
- \`done\` marks this cycle finished
- \`critical-stop\` marks this cycle stopped for a critical reason.
Fires a notify hook (if set) after the write.
`.trim(),
	operation: "deciding at a lap checkpoint",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan, decision, summary, acknowledgeOverrun } = schema.parse(args);
		const { planFile, progress, def, steps, instructions } = loadCycleRun(cwd, plan, { requireActive: true });
		const core: CycleProgress = {
			name: progress.name,
			current: progress.current,
			index: progress.index,
			lap: progress.lap,
			status: "active",
		};

		if (decision === "loop") {
			const looped = applyLoop(core, steps, def.maxLaps);
			if (looped.lapLimitReached && !acknowledgeOverrun) {
				const result = {
					plan,
					cycle: progress.name,
					decision,
					status: "active",
					lap: progress.lap,
					step: progress.current,
					lapLimitReached: true,
					instructions: `Reached the soft cap of ${def.maxLaps} laps. Prefer decision="done" unless you have a concrete gap to tackle.`,
					nextAction: `To continue anyway: \`cycleCheckpoint({ plan: "${plan}", decision: "loop", summary, acknowledgeOverrun: true })\`.`,
				};
				return { data: OutputSchema.parse(result) };
			}
			const next: StoredProgress = looped.progress;
			writeProgress(planFile, next);
			notifyCycleEnd({ decision, summary, plan, cycle: progress.name, lap: next.lap, status: "active" });
			const result = {
				plan,
				cycle: progress.name,
				decision,
				status: "active",
				lap: next.lap,
				step: next.current,
				instructions: appendStepCall(instructions(next.current), plan, next.current),
				nextAction: `New lap ${next.lap} for \`${plan}\`. Do the work for step "${next.current}", then call \`cycleNext({ plan: "${plan}", completed: "${next.current}" })\` to continue.`,
			};
			return { data: OutputSchema.parse(result) };
		}

		const status = decision === "done" ? "done" : "stopped";
		if (decision === "done") {
			// Plan fully consumed: clear the sidecar so nothing lingers to resume and a later
			// cycleStart begins clean without needing force.
			deleteSidecar(planFile);
		} else {
			const next: StoredProgress = { ...core, status, summary };
			writeProgress(planFile, next);
		}
		notifyCycleEnd({ decision, summary, plan, cycle: progress.name, lap: progress.lap, status });
		const result = {
			plan,
			cycle: progress.name,
			decision,
			status,
			lap: progress.lap,
			step: progress.current,
			instructions: summary,
			nextAction:
				decision === "done"
					? `\`${plan}\` done; its cycle sidecar was cleared. Start a cycle on a new plan with \`cycleStart(...)\`.`
					: `\`${plan}\` stopped. Resolve the critical issue, then resume with \`cycleGoto(...)\`.`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
