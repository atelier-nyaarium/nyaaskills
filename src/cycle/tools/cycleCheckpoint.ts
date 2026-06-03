import { z } from "zod";
import { advanceBatch, applyLoop } from "../lib/computeNext.ts";
import { notifyCycleEnd } from "../lib/notify.ts";
import {
	appendStepCall,
	deleteSidecar,
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
Required to loop past the cycle's maxLaps soft cap (plan mode only). Set this if you've found a critical reason to keep pushing.
`.trim(),
		),
	batchSize: z
		.number()
		.int()
		.positive()
		.optional()
		.describe(
			`
Items mode only: on a loop, set how many items the next batch hands over (overrides the run default). Use to back off to smaller batches when items are heavy.
`.trim(),
		),
	skip: z
		.array(z.number().int().nonnegative())
		.optional()
		.describe(
			`
Items mode only: indices (from the current batch) you could not complete and are skipping. Recorded so they are not re-done, and a later cycleAppendItems can deliberately re-queue them.
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
	drained: z.boolean().optional(),
	remaining: z.number().optional(),
	totalItems: z.number().optional(),
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
		const { plan, decision, summary, acknowledgeOverrun, batchSize, skip } = schema.parse(args);
		const { planFile, progress, def, steps, instructions } = loadCycleRun(cwd, plan, { requireActive: true });

		if (decision === "loop" && progress.mode === "items") {
			// Items mode: a loop advances the queue by one batch. The queue (not maxLaps) bounds the run.
			const nextBatchSize = batchSize ?? progress.batchSize;
			// Only items in the just-finished batch can be skipped, so a stray future index cannot mark an
			// unreached item and then let noDup re-queue it into a double-process.
			const mergedSkipped = skip?.length
				? [
						...new Set([
							...progress.skipped,
							...skip.filter((i) => i >= progress.batchStart && i < progress.batchEnd),
						]),
					].sort((a, b) => a - b)
				: progress.skipped;
			const adv = advanceBatch(progress.batchEnd, progress.items.length, nextBatchSize);
			if (adv.drained) {
				// All items consumed. Keep the sidecar (an append could continue it; "queue empty" is not
				// a terminator, an explicit done is), but normalize the window to the end so cycleStatus
				// reports remaining 0 / empty batch and a later append resumes from items.length.
				const drainedProgress: StoredProgress = {
					...progress,
					cursor: progress.items.length,
					batchStart: progress.items.length,
					batchEnd: progress.items.length,
					skipped: mergedSkipped,
				};
				writeProgress(planFile, drainedProgress);
				const skippedNote = mergedSkipped.length ? ` (${mergedSkipped.length} skipped)` : "";
				const result = {
					plan,
					cycle: progress.name,
					decision,
					status: "active",
					lap: progress.lap,
					step: progress.current,
					drained: true,
					remaining: 0,
					totalItems: progress.items.length,
					instructions: `Queue drained: all ${progress.items.length} items processed${skippedNote}.`,
					nextAction: `Append with \`cycleAppendItems({ name, items: [...] })\` then loop again, or finish with \`cycleCheckpoint({ plan: "${plan}", decision: "done", summary })\`. Do not stop unless finishing or blocked.`,
				};
				return { data: OutputSchema.parse(result) };
			}
			// More items remain: wrap steps and bump the lap (preserving the queue), then slide the batch.
			const looped = applyLoop(progress, steps, progress.items.length + 1).progress;
			const next: StoredProgress = {
				...looped,
				cursor: adv.cursor,
				batchStart: adv.batchStart,
				batchEnd: adv.batchEnd,
				batchSize: nextBatchSize,
				skipped: mergedSkipped,
			};
			writeProgress(planFile, next);
			notifyCycleEnd({ decision, summary, plan, cycle: progress.name, lap: next.lap, status: "active" });
			const remaining = progress.items.length - adv.batchStart;
			const result = {
				plan,
				cycle: progress.name,
				decision,
				status: "active",
				lap: next.lap,
				step: next.current,
				remaining,
				totalItems: progress.items.length,
				instructions: `${itemsContext(next)}\n\n---\n\n${appendStepCall(instructions(next.current), plan, next.current)}`,
				nextAction: `Next batch (lap ${next.lap}, ${remaining} items left). Do step "${next.current}", then \`cycleNext({ plan: "${plan}", completed: "${next.current}" })\`. Keep going batch by batch; do not stop until the queue drains or you hit a critical blocker.`,
			};
			return { data: OutputSchema.parse(result) };
		}

		if (decision === "loop") {
			// Plan mode: a loop wraps the steps and bumps the lap. Pass the full record so any extra
			// fields survive; the def's maxLaps is a soft cap against churn-without-convergence.
			const looped = applyLoop(progress, steps, def.maxLaps);
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
				nextAction: `New lap ${next.lap} for \`${plan}\`. Do step "${next.current}", then call \`cycleNext({ plan: "${plan}", completed: "${next.current}" })\`. Continue straight into the next phase; do not stop to ask between phases unless blocked.`,
			};
			return { data: OutputSchema.parse(result) };
		}

		const status = decision === "done" ? "done" : "stopped";
		if (decision === "done") {
			// Plan fully consumed: clear the sidecar so nothing lingers to resume and a later
			// cycleStartPlan begins clean without needing force.
			deleteSidecar(planFile);
		} else {
			const next: StoredProgress = { ...progress, status, summary };
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
					? `\`${plan}\` done; its cycle sidecar was cleared. Start a cycle on a new plan with \`cycleStartPlan(...)\`.`
					: `\`${plan}\` stopped. Resolve the critical issue, then resume with \`cycleGoto(...)\`.`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
