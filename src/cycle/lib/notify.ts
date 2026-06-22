import path from "node:path";
import { z } from "zod";
import { NoticeFull, NoticeSummary, NoticeTitle } from "../../shared/notice.ts";
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
	// Tiered payloads: title is the one-phrase notification-bar line, summary
	// the short (4-6 sentence) outcome, full an optional markdown/mermaid report.
	title: string;
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
	title: string;
	summary: string;
	full?: string;
	attachments?: string[];
	whatToDecide?: string;
	plan: string;
	progress: StoredProgress;
	lap: number;
	// Phases-mode loop only: first lines of the just-finished and upcoming phase
	// items, so the header can say what finished and what comes next.
	finishedPhase?: string;
	nextPhase?: string;
}

////////////////////////////////
//  Schemas

/** The agent-relayed payload shape; mirrors the params of the delivery tool.
 * `summary` is the Short tier carried verbatim as its own addressable field
 * (downstream consumers must not have to parse it back out of the body).
 * The field describes come from the synced notice.ts. */
export const NotifyHumanSchema = z.object({
	title: NoticeTitle,
	summary: NoticeSummary,
	full: NoticeFull,
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
	return `A human notification payload is in \`notifyHuman\`. If a \`${NOTIFY_HUMAN_TOOL_NAME}\` tool is available, call it NOW with that payload's title/summary/full/attachments before continuing; if no such tool exists, skip this silently.`;
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

/** One plain-English sentence stating who did what, per decision. The console
 * threads the notice under the sender's name, but this header also stands
 * alone for any other notify_human provider. */
function headerSentence(ctx: NotifyBuildContext, auto: ReturnType<typeof autoContext>): string {
	const { project, elapsedMs, itemCounts } = auto;
	if (ctx.decision === "critical-stop") {
		return `${project} ran into an issue that needs your attention.`;
	}
	if (ctx.decision === "done") {
		const laps = `${ctx.lap} ${ctx.lap === 1 ? "lap" : "laps"}`;
		const elapsed = elapsedMs !== undefined ? ` in ${humanElapsed(elapsedMs)}` : "";
		return `${project} has completed its run after ${laps}${elapsed}.`;
	}
	if (ctx.finishedPhase && ctx.nextPhase) {
		return `${project} completed phase "${ctx.finishedPhase}" and is continuing on phase "${ctx.nextPhase}".`;
	}
	if (itemCounts) {
		const total = itemCounts.processed + itemCounts.remaining;
		const deferred = itemCounts.deferred > 0 ? `, ${itemCounts.deferred} deferred` : "";
		return `${project} finished a batch (${itemCounts.processed} of ${total} items done${deferred}) and is continuing.`;
	}
	return `${project} finished lap ${ctx.lap} and is continuing.`;
}

/** Pre-composed payload the agent relays verbatim to the delivery tool.
 * Composed server-side so notifications stay uniform and the agent cannot
 * under-report. summary passes through verbatim (urgency rides the
 * flag, not the text; summary stays addressable on its own); full is plain
 * English: a header sentence saying who finished what (and what is next on a
 * phase loop), then the authored 4-6 sentence summary, a decision line when
 * one is needed, and any authored report below a rule. The body repeats the
 * summary on purpose - it must read self-contained in a thread. */
export function buildNotifyHuman(ctx: NotifyBuildContext): NotifyHuman {
	const urgent = ctx.decision === "critical-stop";
	const lines = [headerSentence(ctx, autoContext(ctx)), "", ctx.summary];
	if (ctx.whatToDecide) lines.push("", `Decision needed: ${ctx.whatToDecide}`);
	if (ctx.full) lines.push("", "---", "", ctx.full);
	return {
		title: ctx.title,
		summary: ctx.summary,
		full: lines.join("\n"),
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
