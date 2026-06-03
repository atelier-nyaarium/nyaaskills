import { z } from "zod";
import { appendItems, readPlanFile, type StoredProgress, writeProgress } from "../lib/run.ts";

const schema = z.object({
	name: z
		.string()
		.regex(/^[A-Za-z0-9_-]+$/, "name must be a bare slug (letters, digits, _ or -)")
		.max(200, "name too long")
		.describe(
			`
The items run to append to (the slug passed to cycleStartItems; sidecar plans/<name>.cycle.json).
`.trim(),
		),
	items: z
		.array(z.string().min(1))
		.min(1)
		.describe(
			`
Items to add to the end of the queue. Use to feed a long job in chunks, or to add work discovered mid-run.
`.trim(),
		),
	noDup: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			`
Drop any incoming item already in the queue (normalized: trimmed, trailing slashes stripped), comparing against items NOT marked skipped, so a deliberately re-queued skipped item is kept. Reports the dropped count.
`.trim(),
		),
});

const OutputSchema = z.object({
	name: z.string(),
	plan: z.string(),
	added: z.number(),
	dropped: z.number(),
	totalItems: z.number(),
	instructions: z.string(),
});

export const cycleAppendItems = {
	name: "cycleAppendItems",
	title: "cycle-append-items",
	description: `
Append items to a running items-mode queue. Use to load a large job in smaller chunks back to back, or to add work discovered mid-run. With noDup, already-queued (non-skipped) items are dropped. The write is mtime-guarded and retried on a concurrent change, so it is safe to interleave with stepping.
`.trim(),
	operation: "appending items to a queue",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { name, items: newItems, noDup } = schema.parse(args);
		const plan = `plans/${name}.md`;

		// Re-read and retry on an mtime conflict: append is commutative on the queue tail, so a write
		// that lost a race just recomputes the dedup against the fresh queue and tries again.
		let lastErr: unknown;
		for (let attempt = 0; attempt < 3; attempt++) {
			const planFile = readPlanFile(cwd, plan);
			if (!planFile.progress) {
				throw new Error(`no items run named "${name}"; start one with \`cycleStartItems(...)\` first.`);
			}
			if (planFile.progress.mode !== "items") {
				throw new Error(`run "${name}" is a plan-mode cycle, not an items queue.`);
			}
			const progress = planFile.progress;
			const appended = appendItems(progress.items, progress.skipped, newItems, noDup);
			const next: StoredProgress = { ...progress, items: appended.items };
			try {
				writeProgress(planFile, next);
				const droppedNote = appended.dropped ? `, dropped ${appended.dropped} duplicate(s)` : "";
				const result = {
					name,
					plan,
					added: appended.added,
					dropped: appended.dropped,
					totalItems: appended.items.length,
					instructions: `Appended ${appended.added} item(s)${droppedNote}; queue is now ${appended.items.length}. Keep going - loop to the next batch; do not stop unless finishing or blocked.`,
				};
				return { data: OutputSchema.parse(result) };
			} catch (error) {
				lastErr = error;
				if (error instanceof Error && error.message.includes("changed on disk") && attempt < 2) continue;
				throw error;
			}
		}
		throw lastErr;
	},
};
