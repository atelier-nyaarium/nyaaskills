# Cycle Copy Finetuning

Tighten the agent-facing copy of the cycle MCP. Two surfaces: the static tool `description`
fields (what the agent reads in the palette) and the runtime `instructions` strings the tools
return per call. Four principles, applied across the 8 tools, the instruction builders in
`src/cycle/lib/run.ts`, and the two shipped cycle defs. No state-machine behavior changes; this
is wording, plus moving a few incident explanations out of static text and into runtime returns.

## Questionaire

**1. Descriptions speak from the caller's perspective; drop internal mechanics.**
A description says what the tool does for the caller, not how it works inside. Cut lines like
"Loads the named cycle definition from the library, validates it, writes the starting progress to
a JSON sidecar next to the plan file, and returns the first step's instructions." Keep only what
the agent acts on. For items mode the sidecar path is the resume handle, so that one stays.

**2. Incidents are handled at runtime, not pre-explained in descriptions.**
Edge-case guidance leaves the static descriptions. When the situation actually occurs, the tool
returns self-contained prose in the JSON saying what happened and what to do. The edge-case
context is then present only when it fires, not in the always-loaded description. Targets:
- step no longer in the definition (today: "returns needsResolution instead of guessing")
- bare `cycleNext` with no `completed` (today: "a bare call ... fails safe")
- the step-selection bounce (already carries a `message`; the description paragraph is redundant)

**3. Use formatting in the copy. Bullet lists over crammed inline prose.**
Template literals exist for a reason and Claude parses structure better than run-on sentences.
Option sets become bullet lists, not "`cycleCheckpoint(...)` decides: `loop` (run the steps
again) or `done` (finished)."

**4. Instructions are step-position-aware. Intermediate steps cannot bail.**
Checkpoint is the end-of-lap decision, reached only after the last step (confirmed: the original
understanding was correct). A first or intermediate step needs to know one thing: do its work,
then call `cycleNext`. Concluding a step is the advance, and the way to skip. The lap-boundary
decision (loop / done / critical-stop) is surfaced ONLY at lapEnd, by `cycleNext`'s last-step
return.
- Strip checkpoint mentions from `cyclePreamble` (start-only) and `itemsContext` (every step).
- Keep the "one step at a time, do not run ahead and do the whole plan at once" guard, and keep
  "Current phase N of M" orientation. Those are not bail-mechanics.
- `critical-stop` rides with loop/done at lapEnd; it is not advertised mid-lap. It stays a valid
  call if the agent is genuinely blocked, just not in every step's copy. Matches the standing
  "do not stop between phases unless critical" directive.

## Plan

Surface-grouped phases to minimize churn (each phase is one coherent committable area). No
behavior changes to the state machine; tests assert copy, so they move with it.

### Phase 1: Tool descriptions

Rewrite all 8 `description` strings: `cycleStartPlan`, `cycleStartItems`, `cycleAppendItems`,
`cycleNext`, `cycleCheckpoint`, `cycleStatus`, `cycleGoto`, `cycleList`. Apply principle 1 (cut
internals), 2 (remove incident pre-explanations), 3 (bullets for option sets). Keep the
cross-references that orient the agent (e.g. "for a tracked queue use `cycleStartItems`"), and on
the two start tools keep a one-line pointer that a bounce can come back (the detail lives in the
bounce `message`, not the description).

### Phase 2: Runtime instruction builders (run.ts)

- `cyclePreamble` (start-only): drop the "after the last step checkpoint decides loop/done"
  sentence. Becomes: this is a step-runner, do the current step, call `cycleNext`, one at a time,
  do not run ahead.
- `itemsContext` (every step): drop "; `cycleCheckpoint(...)` advances to the next phase." It
  only frames the current phase/batch and points to `cycleNext`.
- `appendStepCall`: already only says "call `cycleNext`"; tidy formatting only.
- `checkpointCall` (the lapEnd return): the ONE place the decision lives. Format the three
  options as a bullet list. Keep the "default to loop, do not stop" steer.
- `nextAction` strings in `cycleNext` / `cycleCheckpoint`: align to the same minimalist flow.

### Phase 3: Incident runtime prose

Make each incident return self-contained (principle 2), so a description never has to pre-warn:
- vanished step -> prose naming the gone step and pointing at `cycleGoto` to a current step.
- bare `cycleNext` -> prose reporting the current step and asking for `completed` to advance.
- drained queue and the unknown-steps bounce: confirm their existing prose reads well standalone.

### Phase 4: Cycle defs + docs

- `audited-implementation.md` / `plan-refinement.md`: intermediate steps describe only their own
  work (no checkpoint talk). The last step keeps the domain meaning of the decision (loop =
  phases left, done = all phases done); the generic "call checkpoint" mechanic lives in the
  runtime lapEnd copy, so trim any duplication.
- README + tests: update asserted strings; add tests for the incident prose returns.

## Open for refinement

- Where the loop/done copy splits between the runtime lapEnd string (generic mechanic) and a
  def's last-step text (domain meaning). Avoid saying it twice.
- How hard to trim internals in Phase 1 without losing genuinely useful orientation.
- Confirm `critical-stop` belongs at lapEnd only (decision above), not as a mid-lap escape line.
