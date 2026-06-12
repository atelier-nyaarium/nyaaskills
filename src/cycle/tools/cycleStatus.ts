import { z } from "zod";
import { readPlanFile, resolveDef } from "../lib/run.ts";

const schema = z.object({
	plan: z.string().describe(
		`
Path to the plan file.
`.trim(),
	),
});

const OutputSchema = z.object({
	plan: z.string(),
	initialized: z.boolean(),
	cycle: z.string().optional(),
	step: z.string().optional(),
	index: z.number().optional(),
	total: z.number().optional(),
	lap: z.number().optional(),
	status: z.string().optional(),
	mode: z.string().optional(),
	spec: z.string().optional(),
	cursor: z.number().optional(),
	totalItems: z.number().optional(),
	remaining: z.number().optional(),
	currentBatch: z.array(z.string()).optional(),
	skipped: z.number().optional(),
	instructions: z.string().optional(),
	malformed: z.boolean().optional(),
	error: z.string().optional(),
});

export const cycleStatus = {
	name: "cycleStatus",
	title: "cycle-status",
	description: `
Report where a plan is in its cycle without mutating anything: current step, index, lap, and status. Use this to resume, or to tell whether a cycle finished, stopped, or stalled.
`.trim(),
	operation: "reading cycle status",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { plan } = schema.parse(args);
		const planFile = readPlanFile(cwd, plan);
		if (!planFile.progress) {
			return {
				data: OutputSchema.parse({
					plan,
					initialized: false,
					...(planFile.malformed
						? {
								malformed: true,
								error: `cycle sidecar is malformed (${planFile.malformedReason ?? "unreadable"}); fix the JSON at ${planFile.sidecarPath} or restart with force:true`,
							}
						: {}),
				}),
			};
		}
		const progress = planFile.progress;
		// In items/phases mode, surface the queue so a cold resume is inspectable without reading the
		// sidecar. For phases, `currentBatch` holds the current phase's body and `totalItems` is the
		// phase count; `mode` tells the two apart.
		const itemsInfo =
			progress.mode !== "plan"
				? {
						mode: progress.mode,
						spec: progress.spec,
						cursor: progress.cursor,
						totalItems: progress.items.length,
						remaining: progress.items.length - progress.cursor,
						currentBatch: progress.items.slice(progress.batchStart, progress.batchEnd),
						skipped: progress.skipped.length,
					}
				: { mode: "plan" };
		const base = {
			...itemsInfo,
			plan,
			initialized: true,
			cycle: progress.name,
			step: progress.current,
			index: progress.index,
			lap: progress.lap,
			status: progress.status,
		};
		// Status is the diagnostic tool, so it must not throw when the definition drifted or vanished.
		try {
			const { def, instructions } = resolveDef(progress.name);
			// Report against the effective step list (the per-run subset if set), not the def's full list.
			const effectiveSteps = progress.steps ?? def.steps;
			const known = effectiveSteps.includes(progress.current);
			return {
				data: OutputSchema.parse({
					...base,
					total: effectiveSteps.length,
					...(known
						? { instructions: instructions(progress.current) }
						: {
								error: `current step "${progress.current}" is no longer in cycle "${progress.name}"; steps: ${effectiveSteps.join(", ")}`,
							}),
				}),
			};
		} catch (error) {
			return { data: OutputSchema.parse({ ...base, error: (error as Error).message }) };
		}
	},
};
