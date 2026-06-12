import type { CycleStatus } from "./computeNext.ts";

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

// Extension point. The end-of-lap checkpoint calls this after the progress write succeeds, so a
// notification failure can never corrupt cycle state. Reserved for LOCAL side effects (audio,
// terminal bell): cross-plugin delivery (e.g. switchboard's notify_human) happens agent-side via
// the relay payload embedded in the checkpoint RESULT, because an MCP server cannot call another
// plugin's tools. Kept side-effect-free by default.
export function notifyCycleEnd(_event: CycleEndEvent): void {
	// no-op stub
}
