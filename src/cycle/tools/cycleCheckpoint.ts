import path from "node:path";
import { z } from "zod";
import { advanceBatch, applyLoop } from "../lib/computeNext.ts";
import { notifyCycleEnd } from "../lib/notify.ts";
import {
	appendStepCall,
	deleteSidecar,
	humanElapsed,
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
	tiny: z
		.string()
		.min(1)
		.max(100)
		.describe(
			`
One phrase for a notification bar (~60 chars): the lap's outcome at a glance.
`.trim(),
		),
	summary: z
		.string()
		.min(1)
		.describe(
			`
What this lap did and the outcome. 4 sentences max.
`.trim(),
		),
	full: z
		.string()
		.optional()
		.describe(
			`
Optional full markdown report (mermaid welcome) for the human notification. Encouraged on done and critical-stop.
`.trim(),
		),
	attachments: z
		.array(z.string())
		.optional()
		.describe(
			`
Optional absolute file paths (screenshots, logs) to ride along with the notification.
`.trim(),
		),
	whatToDecide: z
		.string()
		.optional()
		.describe(
			`
critical-stop only: the specific decision or approval the human must make.
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

const NotifyHumanSchema = z.object({
	tiny: z.string(),
	full: z.string(),
	attachments: z.array(z.string()).optional(),
	urgent: z.boolean(),
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
	notifyHuman: NotifyHumanSchema.optional(),
	instructions: z.string(),
	nextAction: z.string(),
});

interface NotifyContext {
	cwd: string;
	decision: "done" | "loop" | "critical-stop";
	tiny: string;
	summary: string;
	full?: string;
	attachments?: string[];
	whatToDecide?: string;
	plan: string;
	progress: StoredProgress;
	lap: number;
}

/** Auto context the server already has: project, elapsed, items counts. */
function autoContext(ctx: NotifyContext) {
	const project = path.basename(ctx.cwd);
	const elapsedMs = ctx.progress.startedAt ? Date.now() - ctx.progress.startedAt : undefined;
	const itemCounts =
		ctx.progress.mode === "plan"
			? undefined
			: {
					processed: ctx.progress.cursor,
					remaining: ctx.progress.items.length - ctx.progress.cursor,
					deferred: ctx.progress.deferredItemIndexes.length,
				};
	return { project, elapsedMs, itemCounts };
}

/** Pre-composed payload the agent relays verbatim to a notify_human-style tool.
 * Composed server-side so notifications stay uniform and the agent cannot
 * under-report: tiny is the bar line, full is a markdown report with the run's
 * identity, elapsed time, queue counts, the summary, and any authored report. */
function buildNotifyHuman(ctx: NotifyContext): z.infer<typeof NotifyHumanSchema> {
	const { project, elapsedMs, itemCounts } = autoContext(ctx);
	const urgent = ctx.decision === "critical-stop";
	const meta = [
		`- Project: \`${project}\` - plan \`${ctx.plan}\` - cycle \`${ctx.progress.name}\` - lap ${ctx.lap}`,
		`- Decision: **${ctx.decision}**${elapsedMs !== undefined ? ` - elapsed ${humanElapsed(elapsedMs)}` : ""}`,
	];
	if (itemCounts) {
		meta.push(
			`- Items: ${itemCounts.processed} done, ${itemCounts.remaining} remaining, ${itemCounts.deferred} deferred`,
		);
	}
	const sections = [`# ${ctx.tiny}`, "", ...meta, ""];
	if (ctx.whatToDecide) sections.push(`**Decision needed:** ${ctx.whatToDecide}`, "");
	sections.push(ctx.summary);
	if (ctx.full) sections.push("", "---", "", ctx.full);
	return {
		tiny: urgent ? `[NEEDS YOU] ${ctx.tiny}` : ctx.tiny,
		full: sections.join("\n"),
		attachments: ctx.attachments?.length ? ctx.attachments : undefined,
		urgent,
	};
}

/** The agent-side relay sentence. Plugins compose through the agent: this result
 * tells it to forward the payload IF a notification tool exists; a cycles-only
 * setup simply skips it. */
function relayInstruction(): string {
	return `A human notification payload is in \`notifyHuman\`. If a \`notify_human\` tool is available, call it NOW with that payload's tiny/full/attachments before continuing; if no such tool exists, skip this silently.`;
}

export const cycleCheckpoint = {
	name: "cycleCheckpoint",
	title: "cycle-checkpoint",
	description: `
The end-of-lap decision, made after the last step. Give a one-phrase \`tiny\` headline, a \`summary\` (4 sentences max), and one decision:
- \`loop\` - do another lap (the default; keep going)
- \`done\` - the work is complete, or another lap would add only minimal gains. This is the run's cleanup: it clears the run state and sends the end-of-run notification, so a finished run is not over until \`done\` is called. Include \`full\` (markdown report) when you have one.
- \`critical-stop\` - a real blocker needs a human; include \`whatToDecide\`
`.trim(),
	operation: "deciding at a lap checkpoint",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan, decision, tiny, summary, full, attachments, whatToDecide, batchSize, defer } = schema.parse(args);
		const { planFile, progress, steps, instructions } = loadCycleRun(cwd, plan, { requireActive: true });

		// done/critical-stop always notify; lap ends only when the run opted in.
		const notifyOnLoop = (progress.notify ?? "done") === "laps";
		const makeNotify = (lap: number): z.infer<typeof NotifyHumanSchema> =>
			buildNotifyHuman({ cwd, decision, tiny, summary, full, attachments, whatToDecide, plan, progress, lap });
		const eventExtras = (lap: number) => {
			const { project, elapsedMs, itemCounts } = autoContext({
				cwd,
				decision,
				tiny,
				summary,
				full,
				attachments,
				whatToDecide,
				plan,
				progress,
				lap,
			});
			return { tiny, full, attachments, whatToDecide, project, elapsedMs, itemCounts };
		};

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
						? `Finish with \`cycleCheckpoint({ plan: "${plan}", decision: "done", tiny, summary })\`. Do not stop unless finishing or blocked.`
						: `Append with \`cycleAppendItems({ name, items: [...] })\` then loop again, or finish with \`cycleCheckpoint({ plan: "${plan}", decision: "done", tiny, summary })\`. Do not stop unless finishing or blocked.`,
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
			notifyCycleEnd({
				decision,
				summary,
				plan,
				cycle: progress.name,
				lap: next.lap,
				status: "active",
				...eventExtras(next.lap),
			});
			const remaining = progress.items.length - adv.batchStart;
			const notifyHuman = notifyOnLoop ? makeNotify(progress.lap) : undefined;
			const result = {
				plan,
				cycle: progress.name,
				decision,
				status: "active",
				lap: next.lap,
				step: next.current,
				remaining,
				totalItems: progress.items.length,
				notifyHuman,
				instructions: `${itemsContext(next)}\n\n---\n\n${appendStepCall(instructions(next.current), plan, next.current)}`,
				nextAction: `${notifyHuman ? `${relayInstruction()} ` : ""}Next ${isPhases ? "phase" : "batch"} (lap ${next.lap}, ${remaining} ${isPhases ? "phases" : "items"} left). Do step "${next.current}", then \`cycleNext({ plan: "${plan}", completed: "${next.current}" })\`. Keep going; do not stop until ${isPhases ? "all phases are done" : "the queue drains"} or you hit a critical blocker.`,
			};
			return { data: OutputSchema.parse(result) };
		}

		if (decision === "loop") {
			// Plan mode: a loop wraps the steps and bumps the lap. Pass the full record so any extra
			// fields survive.
			const next: StoredProgress = applyLoop(progress, steps);
			writeProgress(planFile, next);
			notifyCycleEnd({
				decision,
				summary,
				plan,
				cycle: progress.name,
				lap: next.lap,
				status: "active",
				...eventExtras(next.lap),
			});
			const notifyHuman = notifyOnLoop ? makeNotify(progress.lap) : undefined;
			const result = {
				plan,
				cycle: progress.name,
				decision,
				status: "active",
				lap: next.lap,
				step: next.current,
				notifyHuman,
				instructions: appendStepCall(instructions(next.current), plan, next.current),
				nextAction: `${notifyHuman ? `${relayInstruction()} ` : ""}New lap ${next.lap} for \`${plan}\`. Do step "${next.current}", then call \`cycleNext({ plan: "${plan}", completed: "${next.current}" })\`. Continue straight into the next phase; do not stop to ask between phases unless blocked.`,
			};
			return { data: OutputSchema.parse(result) };
		}

		const status = decision === "done" ? "done" : "stopped";
		// Notification context is built BEFORE the sidecar is cleared, so done still
		// reports elapsed time and counts.
		const notifyHuman = makeNotify(progress.lap);
		const extras = eventExtras(progress.lap);
		if (decision === "done") {
			// Plan fully consumed: clear the sidecar so nothing lingers to resume and a later
			// cycleStartPlan begins clean without needing force.
			deleteSidecar(planFile);
		} else {
			const next: StoredProgress = { ...progress, status, summary };
			writeProgress(planFile, next);
		}
		notifyCycleEnd({ decision, summary, plan, cycle: progress.name, lap: progress.lap, status, ...extras });
		const result = {
			plan,
			cycle: progress.name,
			decision,
			status,
			lap: progress.lap,
			step: progress.current,
			notifyHuman,
			instructions: summary,
			nextAction: `${relayInstruction()} ${
				decision === "done"
					? `\`${plan}\` done; its cycle sidecar was cleared. Start a cycle on a new plan with \`cycleStartPlan(...)\`.`
					: `\`${plan}\` stopped. Resolve the critical issue, then resume with \`cycleGoto(...)\`.`
			}`,
		};
		return { data: OutputSchema.parse(result) };
	},
};
