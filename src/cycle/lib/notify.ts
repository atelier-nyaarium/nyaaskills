import path from "node:path";
import { z } from "zod";
import type { CycleStatus } from "./computeNext.ts";
import { humanElapsed, type StoredProgress } from "./run.ts";

////////////////////////////////
//  Interfaces & Types

/**
 * Raw end-of-lap facts for LOCAL side effects (audio, terminal bell). The
 * agent never sees this shape; the cross-plugin presentation is composed from
 * it as a NotifyHuman payload (see buildNotifyHuman). Keep the split: event =
 * facts, payload = presentation.
 */
export interface CycleEndEvent {
	decision: "done" | "loop" | "critical-stop";
	// Tiered payloads: tiny is the one-phrase notification-bar line, summary the
	// short (<= 4 sentence) outcome, full an optional markdown/mermaid report.
	tiny: string;
	summary: string;
	full?: string;
	attachments?: string[];
	// critical-stop only: the specific decision a human must make.
	whatToDecide?: string;
	plan: string;
	cycle: string;
	lap: number;
	status: CycleStatus;
	// Auto context the server adds: project dir name, elapsed since startedAt,
	// and items-mode queue counts.
	project?: string;
	elapsedMs?: number;
	itemCounts?: { processed: number; remaining: number; deferred: number };
}

/** Everything buildNotifyHuman needs: the authored tiers plus run identity. */
export interface NotifyBuildContext {
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

////////////////////////////////
//  Schemas

/** The agent-relayed payload shape; mirrors the params of the delivery tool. */
export const NotifyHumanSchema = z.object({
	tiny: z.string(),
	full: z.string(),
	attachments: z.array(z.string()).optional(),
	urgent: z.boolean(),
});

export type NotifyHuman = z.infer<typeof NotifyHumanSchema>;

////////////////////////////////
//  Functions & Helpers

// The cross-plugin delivery tool's name. Pinned here as the single anchor for
// the contract: switchboard registers a tool by this name, and the relay
// instruction below references it. Keep in lockstep with switchboard's
// notify_human tool registration.
export const NOTIFY_HUMAN_TOOL_NAME = "notify_human";

/** The agent-side relay sentence. Plugins compose through the agent: a result
 * carrying this tells it to forward the payload IF a notification tool exists;
 * a cycles-only setup simply skips it. */
export function relayInstruction(): string {
	return `A human notification payload is in \`notifyHuman\`. If a \`${NOTIFY_HUMAN_TOOL_NAME}\` tool is available, call it NOW with that payload's tiny/full/attachments before continuing; if no such tool exists, skip this silently.`;
}

/** Auto context the server already has: project, elapsed, items counts. */
export function autoContext(ctx: Pick<NotifyBuildContext, "cwd" | "progress">) {
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

/** Pre-composed payload the agent relays verbatim to the delivery tool.
 * Composed server-side so notifications stay uniform and the agent cannot
 * under-report: tiny is the bar line, full is a markdown report with the run's
 * identity, elapsed time, queue counts, the summary, and any authored report. */
export function buildNotifyHuman(ctx: NotifyBuildContext): NotifyHuman {
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

// Extension point. The end-of-lap checkpoint calls this after the progress write succeeds, so a
// notification failure can never corrupt cycle state. Reserved for LOCAL side effects (audio,
// terminal bell): cross-plugin delivery (the notify_human relay) happens agent-side via the
// payload embedded in the checkpoint RESULT, because an MCP server cannot call another plugin's
// tools. Kept side-effect-free by default.
export function notifyCycleEnd(_event: CycleEndEvent): void {
	// no-op stub
}
