# Cycle Tool: Items Mode

Add an items-queue mode to the cycle tool so a run can process an explicit, ordered list of
targets (e.g. 100 files from `find`) one batch at a time, with the tool tracking progress durably
instead of relying on the agent to faithfully edit a plan doc.

## Questionaire

**1. Batch model - is a lap one item, or one batch of items?**

Selected: **Batch is the work-unit.** One lap processes K items together through the full step
sequence (e.g. implement all K, then align all K, then red-team all K). Coarser granularity, fewer
checkpoints; resume lands on a batch boundary, not an individual item.

**2. Items-mode spec - where does the per-item task live?**

Selected: **The sidecar carries the spec.** cycleStartItems takes a `spec` string (the per-item
task, e.g. "Add foobar header to each file"), persisted in the sidecar and re-injected at the top of
every batch's instructions. Not reliant on agent context/memory, so it survives compaction and full
restarts. Rationale (user agreed after I overruled "pure context"): current models do not reliably
hold a verbatim spec over compaction or long horizons, and durable progress paired with an ephemeral
spec is incoherent. The `spec` may point at a file for large specs, but defaults to a string.

**3. Run handle in items mode - how is a run identified and resumed?**

Selected: **An agent-chosen name/id.** At cycleStartItems the agent picks a short descriptive slug
(e.g. "migrate-ts"); the sidecar lives at `./plans/<name>.cycle.json`. Resume by passing the same
name. Human-readable and discoverable (`ls ./plans/`), which serves the durable-resume goal better
than an opaque auto-id.

**4. Termination - when does an items run end? (revised after lap-1 audit)**

**Explicit `done`, expressed through the existing checkpoint. No auto-done.** In items mode
`cycleCheckpoint` keeps its vocabulary: `loop` = advance to the next batch; when the queue is drained
(cursor at end), `loop` returns a "queue drained - append more or call `done`" state and KEEPS the
sidecar. `done` ends the run and deletes the sidecar (same as plan mode). `critical-stop` keeps it
(resumable). The agent always ends a run explicitly; "queue empty" is a prompt, not a terminator.

Why changed from the original auto-done: (1) auto-delete-on-empty raced the chunked-append pattern
(drain -> sidecar deleted -> next append throws "no cycle"), and (2) it contradicted the Q2
durability rationale, since "reopen, the spec is in recent context" relies on the exact memory Q2
says is unreliable. Explicit-done reuses machinery that already exists, adds no new concept, and keeps
the sidecar alive until the agent is genuinely finished.

**5. Scope - what changes vs what stays? (user clarification)**

Items mode is **additive**, not a separate system. `cycleNext`, `cycleCheckpoint`, `cycleGoto`,
`cycleStatus`, the steps, and the cycle-definition selection (`plan-refinement`,
`audited-implementation`, future defs) all stay and behave as today. Only deltas:
- Spec carrier: a plan `.md` is no longer required; the spec can live in the sidecar as a string.
- Work unit: an items queue processed in batches (Q1), one batch per lap.
- New `cycleAppendItems` tool to grow the queue (with a no-dup option).
- Done is queue-driven (Q4).

Two entry points feed the same machinery: `cycleStartPlan` (spec = plan `.md`) and `cycleStartItems`
(spec = sidecar string + queue). In items mode, `cycleCheckpoint` `loop` means "advance to the next
batch."

**6. Queue mechanics (defaults accepted).**

- `batchSize` is **adjustable**: a default is set at `cycleStartItems`, but the agent can shrink or
  grow how many the next batch hands over (back off when items are heavy).
- `cycleAppendItems` with `noDup` **dedups by exact item string against the whole queue** (pending +
  already-processed), so a target is never re-enqueued or re-done; it reports how many it dropped.
- Processed items are **retained, not pruned** - forced by `noDup` (you can only dedup against
  remembered targets). The sidecar keeps the full queue + cursor, so resume is exact. Sidecar grows
  with total items seen; `log` a soft-cap warning past some threshold rather than silently bloating.

**7. Entry-point split (confirmed).**

Split today's `cycleStart` into `cycleStartPlan` (current behavior) + `cycleStartItems` (new). This
is a breaking rename of the tool surface, so all introduction/description text gets updated: the
"do cycles" cue, the start preamble, the cycle-def prose, and the README all move from `cycleStart`
to the correct entry point.

## Plan (v2, post lap-1 audit)

### Data model (`ProgressSchema` / sidecar)

Add an items sub-record. It is a **co-required group** with an explicit discriminant, not loose
optional fields, so the two modes cannot half-populate or cross-contaminate (audit: mode-discriminant
gap). Either `mode: "plan"` (no items fields) or `mode: "items"` with all of:
- `spec: string` - the per-item task; re-injected on every step (not just batch top).
- `items: string[]` - the ordered queue; retains processed items for dedup and exact resume.
- `cursor: number` - index of the next unprocessed item. Invariant `0 <= cursor <= items.length`;
  validated and clamped like the step `index` already is; "drained" iff `cursor >= items.length`.
- `batchStart` / `batchEnd` - the **in-flight batch range**, written when a batch is handed out.
  Resume replays exactly `[batchStart, batchEnd)`. `cursor` alone + a mutable `batchSize` cannot
  reconstruct an interrupted batch (audit: in-flight width gap).
- `batchSize: number` - default width for the *next* batch (overridable per advance, see tools).
- `skipped: number[]` - item indices the agent disposed without doing (audit: per-item failure gap).

Validate `items.length >= 1` and `batchSize >= 1` at entry. `lap` still increments per batch.

### The load-bearing fix (audit BLOCKER)

`cycleCheckpoint` currently rebuilds progress from `core: CycleProgress` (name/current/index/lap/
status only), so the new fields would be wiped on every `loop` and `critical-stop`. Fix first: thread
the full `StoredProgress` through `applyLoop` and all three checkpoint branches (spread `...progress`,
as `cycleGoto`/`cycleNext` already do). Add a test asserting `items`/`spec`/`cursor` survive a `loop`
and a `critical-stop`. Nothing else works until this lands.

### Tools

- `cycleStartPlan` - hard rename of current `cycleStart` (no alias); behavior unchanged (spec = plan
  `.md`). Rename surface includes the three hardcoded agent-facing strings the audit found:
  `cycleCheckpoint.ts` done-message, `run.ts` loadCycleRun error, `cycleList.ts` description, plus
  `index.ts`, the MCP registration, `README.md`, and `cycle.test.ts` (imports, call sites, and the
  "exports N tools" count: 6 -> 7 after this phase (the rename is net-zero, +cycleStartItems), then
  -> 8 when Phase 4 adds cycleAppendItems).
- `cycleStartItems({ name, cycle, spec, items, batchSize? })` - agent-chosen `name`; sidecar at
  `./plans/<name>.cycle.json`. `name` is sanitized as a bare slug (`^[A-Za-z0-9_-]+$`, reusing the
  cycle-name guard) and resolved through `resolvePlanPath`/`writeProgress` so it inherits the symlink
  + path-escape guards. `mkdir -p ./plans` if absent. Note the collision: a plan-mode run on
  `./plans/<name>.md` derives the same `.cycle.json`; document that an items `name` and a plan
  basename share a namespace.
- `cycleAppendItems({ name, items, noDup? })` - appends to the queue. Routes through `loadCycleRun` +
  `writeProgress` so it inherits the mtime guard; on guard conflict it re-reads and retries (append
  is commutative on the tail). `noDup` normalizes before comparing (`path.resolve` + trailing-slash
  trim), dedups the incoming batch against itself AND against **already-processed** items only (so a
  deliberately re-added skipped item is allowed through), and reports the dropped count.
- Advance tools accept the items `name` (resolving to the same sidecar) and stay otherwise unchanged.
  Items-aware behavior:
  - `cycleCheckpoint` `loop` advances `cursor` to the next batch; when drained, returns "queue
    drained - append or `done`" and keeps the sidecar (see Termination). Gains an optional
    `batchSize?` to set the next batch width (the carrier the audit found missing).
  - `cycleStatus` surfaces `spec`, `cursor`, `totalItems`, `remaining`, `skipped`, and the current
    batch, so a cold resume is inspectable read-only.
  - `cycleNext` surfaces the current batch + counts.

### Per-step instruction injection (audit: mid-batch compaction hole)

The re-grounding helper runs on **every `cycleNext` step**, not just batch top, since a 5-step batch
can be compacted mid-batch where `cycleNext` otherwise carries step text only:
```
Spec: <spec>
Batch <b>/<total> (items <i>-<j> of <N>): <the batch's items>
[one-line operating reminder: one batch at a time, checkpoint between batches]
```
prepended to the step instructions. The items-mode preamble names spec/queue/batch.

### Termination

Explicit `done` via the existing checkpoint (Q4 revised): `loop` advances or, when drained, prompts
append-or-`done` and keeps the sidecar; `done` deletes it; `critical-stop` keeps it. No auto-delete.

### maxLaps (audit: trips mid-queue)

Decide now, not at implementation. In items mode `lap == batch`, so the def's `maxLaps` (8/12) would
nag every batch past the cap and the "prefer done" message can make an agent end the queue early.
Effective cap = `ceil(items.length / batchSize)` + slack, recomputed when the queue grows or
`batchSize` changes; the def `maxLaps` only guards genuine re-loop runaway.

### Idempotency note (audit: commit replay)

Batch re-execution on resume must be idempotent. For `audited-implementation` the `commit` step must
tolerate an already-clean tree, and the cursor advance should be ordered so a committed batch is not
replayed into a duplicate commit. Document that re-running a batch assumes idempotent steps.

### Cycle-def scope

Items mode targets `audited-implementation`-style defs (mechanical per-item work). `plan-refinement`
("until it converges / feels solid") does not fit a fixed queue; either scope it out or reword its
checkpoint help for items mode. Default `batchSize: 1` for `audited-implementation` (heavy per-item
steps, per-batch commits); larger batches suit uniform mechanical specs. Provide batchSize guidance
in the preamble, not just a knob.

### Introduction / wording updates (the split)

Hard-rename `cycleStart` -> `cycleStartPlan` across the surface listed under Tools. `cycleStartItems`
gets its own description and the "do cycles" cue. The preamble branches: plan-mode wording vs
items-mode wording (spec + queue + batch + batchSize guidance). Note: the existing cycle-def `.md`
bodies do NOT mention `cycleStart`, so they are not part of this rename (audit corrected the original
blast-radius list).

### Tests

Queue lifecycle: start; batch through to drained (prompts append-or-done, sidecar persists); `done`
deletes; `cycleAppendItems` + `noDup` drop count (incl. normalized-path collisions and re-added
skips); resume mid-queue replays the exact `[batchStart, batchEnd)`; spec re-injection present on
each step (not just batch top); `batchSize` override on `loop`; `critical-stop` keeps the sidecar;
**`loop` and `critical-stop` preserve `items`/`spec`/`cursor`** (the load-bearing fix); skip
disposition persists; mode discriminant rejects a half-populated sidecar as malformed.

### Open / defer (explicitly bounded)

- Retention scale: full `items` retention is fine for the 100s-of-items target. Past a threshold (pick
  a number, e.g. 5000) compact processed items to a count + hash set for dedup rather than retaining
  every string. `log` the cap; do not silently bloat. The O(n) serialize + O(n) dedup per append is
  acceptable at target scale.
- `spec`-points-at-a-file contract (syntax, root-containment, read-once-and-inline): defer; the
  default string covers v1. When added, inline once at start so the sidecar owns the text.
- `cycleSkipItems` as a first-class tool (vs recording skips in the checkpoint summary): defer;
  the `skipped[]` field + summary covers v1.
