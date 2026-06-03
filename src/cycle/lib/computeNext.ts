export type CycleStatus = "active" | "done" | "stopped";

export interface CycleProgress {
	name: string;
	current: string;
	index: number;
	lap: number;
	status: CycleStatus;
}

export type AdvanceResult =
	| { kind: "advance"; current: string; index: number }
	| { kind: "lapEnd" }
	| { kind: "needsResolution"; oldCurrent: string; suggested: string };

// Resolve a step name against the canonical list, case-insensitively, returning the canonical
// casing (or null). Callers that take a user-supplied step (e.g. goto) should store the result
// so a later case-sensitive advance() never misses.
export function findStep(steps: string[], name: string): string | null {
	const target = name.trim().toLowerCase();
	return steps.find((s) => s.toLowerCase() === target) ?? null;
}

// Locate the current step by name; the stored index is only a fallback hint for recovery.
export function advance(steps: string[], current: string, indexFallback: number): AdvanceResult {
	if (steps.length === 0) throw new Error("cannot advance an empty step list");
	const idx = steps.indexOf(current);
	if (idx === -1) {
		// A non-integer fallback (e.g. a hand-corrupted index in the front matter) recovers to 0.
		const safe = Number.isInteger(indexFallback) ? indexFallback : 0;
		const clamped = Math.min(Math.max(safe, 0), steps.length - 1);
		return { kind: "needsResolution", oldCurrent: current, suggested: steps[clamped] };
	}
	if (idx < steps.length - 1) return { kind: "advance", current: steps[idx + 1], index: idx + 1 };
	return { kind: "lapEnd" };
}

export interface LoopResult {
	progress: CycleProgress;
	lapLimitReached: boolean;
}

// Wrap to the first step and bump the lap. Caller gates the actual write on lapLimitReached
// unless the agent acknowledged the overrun.
export function applyLoop(progress: CycleProgress, steps: string[], maxLaps: number): LoopResult {
	if (steps.length === 0) throw new Error("cannot loop an empty step list");
	const lap = progress.lap + 1;
	return {
		progress: {
			...progress,
			current: steps[0],
			index: 0,
			lap,
			status: "active",
		},
		// Laps are 1-indexed (lap 1 is the first lap), so a loop into lap maxLaps+1 trips the cap;
		// laps 1..maxLaps are allowed.
		lapLimitReached: lap > maxLaps,
	};
}
