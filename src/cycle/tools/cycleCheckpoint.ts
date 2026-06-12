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
	defer: z
		.array(z.number().int().nonnegative())
		.optional()
		.describe(
			`
Items mode only: indices (from the current batch) to set aside without completing. Deferred items are not re-done by the queue; re-queue one deliberately by appending it again.
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
The end-of-lap decision, made after the last step. Give a 1-2 sentence summary of the lap, plus one decision:
- \`loop\` - do another lap (the default; keep going)
- \`done\` - the work is complete, or another lap would add only minimal gains
- \`critical-stop\` - a real blocker needs a human
`.trim(),
	operation: "deciding at a lap checkpoint",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan, decision, summary, batchSize, defer } = schema.parse(args);
		const { planFile, progress, steps, instructions } = loadCycleRun(cwd, plan, { requireActive: true });

		if (decision === "loop" && progress.mode !== "plan") {
			// Items/phases mode: a loop advances the queue by one batch (one phase). The queue bounds the run.
			const isPhases = progress.mode === "phases";
			// Phases are definitionally one-per-lap: ignore the items-only batchSize override and defer,
			// or a batchSize > 1 would slide the window past unvisited phases and silently drop them.
			const nextBatchSize = isPhases ? 1 : (batchSize ?? progress.batchSize);
			// Only items in the just-finished batch can be deferred, so a stray future index cannot mark
			// an unreached item and then let dedupe re-queue it into a double-process.
			const mergedDeferred =
				!isPhases && defer?.length
					? [
							...new Set([
								...progress.deferredItemIndexes,
								...defer.filter((i) => i >= progress.batchStart && i < progress.batchEnd),
							]),
						].sort((a, b) => a - b)
					: progress.deferredItemIndexes;
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
					deferredItemIndexes: mergedDeferred,
				};
				writeProgress(planFile, drainedProgress);
				const deferredNote = mergedDeferred.length ? ` (${mergedDeferred.length} deferred)` : "";
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
					instructions: isPhases
						? `All ${progress.items.length} phases done${deferredNote}.`
						: `Queue drained: all ${progress.items.length} items processed${deferredNote}.`,
					nextAction: isPhases
						? `Finish with \`cycleCheckpoint({ plan: "${plan}", decision: "done", summary })\`. Do not stop unless finishing or blocked.`
						: `Append with \`cycleAppendItems({ name, items: [...] })\` then loop again, or finish with \`cycleCheckpoint({ plan: "${plan}", decision: "done", summary })\`. Do not stop unless finishing or blocked.`,
				};
				return { data: OutputSchema.parse(result) };
			}
			// More items remain: wrap steps and bump the lap (preserving the queue), then slide the batch.
			const looped = applyLoop(progress, steps);
			const next: StoredProgress = {
				...looped,
				cursor: adv.cursor,
				batchStart: adv.batchStart,
				batchEnd: adv.batchEnd,
				batchSize: nextBatchSize,
				deferredItemIndexes: mergedDeferred,
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
				nextAction: `Next ${isPhases ? "phase" : "batch"} (lap ${next.lap}, ${remaining} ${isPhases ? "phases" : "items"} left). Do step "${next.current}", then \`cycleNext({ plan: "${plan}", completed: "${next.current}" })\`. Keep going; do not stop until ${isPhases ? "all phases are done" : "the queue drains"} or you hit a critical blocker.`,
			};
			return { data: OutputSchema.parse(result) };
		}

		if (decision === "loop") {
			// Plan mode: a loop wraps the steps and bumps the lap. Pass the full record so any extra
			// fields survive.
			const next: StoredProgress = applyLoop(progress, steps);
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
