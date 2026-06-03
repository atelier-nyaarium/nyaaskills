# Cycle: Plan Phases + Configurable Steps

Two features extending how a cycle starts:
1. The plan route tracks the plan's phases in the sidecar (crash recovery when the agent forgets).
2. Cycle definitions support per-run step selection, with a confirm-bounce when settings are blank.

## Questionaire

**1. Feature 1 - how do plan-mode phases relate to the items machinery?**

User: "They need to merge somehow. I'll let you decide." (delegated)

Decision: **Merge by reusing the items machinery.** `cycleStartPlan` gains an optional `phases: string[]`.
With phases, the run is an items-mode run internally (`mode: "items"`): items = the phase labels,
`batchSize` = 1 (one phase per lap), and the spec is a generated pointer ("Implement the plan at
`<plan>` one phase at a time; the current phase is shown, read the plan for its detail"). The persisted
cursor over phases IS the crash-recovery mechanism, and cycleStatus / cycleAppendItems / resume all
work for free. Without phases, plan mode stays freeform (`mode: "plan"`, unchanged). Phases must match
the plan doc, validated by checking each phase label appears in the plan file content.

**2. Feature 2 - step skippability model?**

Selected: **All steps on by default (full suite); any step skippable, including commit.** No
mandatory/optional marking in the .md; steps are listed normally and the user omits whatever they
don't want. Trusts the user/agent not to skip something nonsensical.

**3. Feature 2 - how is the step selection passed and validated?**

Selected: **`includeSteps` (run exactly the listed steps),** with a two-way bounce:
- `includeSteps` absent -> bounce returns the full step list + a confirm prompt for the user
  ("This is the cycle that will run. Full suite unless you want some skipped: 1. implement, 2. align,
  ...). The agent shows it, the user greenlights or names omissions, the agent re-calls with the kept
  steps.
- `includeSteps` with unknown/misspelled ids -> bounce returns a "Did you mean?" list (fuzzy match
  against the def's real step names), so a typo never silently drops or mis-selects a step.
- `includeSteps` with valid ids -> proceed, running exactly those steps.

**4. Security vs compliance as steps?**

User: "Security is implied by compliance." So **one new step, `compliance`** (the `/compliance` skill:
SOC2/GDPR/CPRA). No separate step beyond it; `red-team` already covers adversarial review.

**5. Feature 1 scope (after the audit found pointer-recovery too thin)?**

Selected: **Full sound redesign.** A real `mode: "phases"`: the tool finds each phase's `##` section in
the plan and persists its body, so a cold resume injects the actual phase detail (not a pointer);
phase labels are validated against the plan's `##` headers (not substring-in-content); the plan path
is stored in the sidecar. (Audit: no cycle tool reads the plan file, so the original label+pointer
design was weaker than plain plan mode.)

## Plan (v2, post refinement lap 1)

### Feature 1: plan-mode phase tracking (`mode: "phases"`)

- `cycleStartPlan` gains optional `phases?: string[]` (phase labels). Without it, plan mode is
  unchanged (`mode: "plan"`).
- New discriminant **`mode: "phases"`** (third union member) so `cycleStatus`, `cycleAppendItems`, and
  the maxLaps/overrun branch treat it honestly instead of masquerading as `mode: "items"` (audit:
  a "plan" run reporting `mode: items` mislabels status and opens an unvalidated append path).
- At start: parse the plan's `##` sections with `extractSections`. Case-folded-match each phase label
  to a section header; any unmatched -> error listing the unmatched labels + the real headers (the
  did-you-mean source). This is header-match, NOT substring-in-content (audit: substring is
  false-positive/negative prone and validates the wrong contract). For each matched phase, persist its
  **section body** (so cold resume injects the actual detail, not a pointer - no cycle tool reads the
  plan file at runtime). Store the **plan path** in the record.
- Reuses the items engine: cursor over phases, `batchSize` 1 (one phase per lap), and the per-run step
  subset (Feature 2) drives the steps per phase. `cycleStatus` / `itemsContext` are **phase-aware**:
  inject the current phase's persisted body, and say "phase N/M: <label>" not "batch / items".
- Addressing: a phases run is keyed by the **plan path** (stored in the record), like the rest of
  cycleStartPlan's tools. The slug-addressed `cycleAppendItems` does NOT apply to phases runs. Document
  that a phases run and an items run must not share a `plans/<name>` stem.

### Feature 2: configurable steps (`includeSteps` + bounce)

- Both start tools gain optional `includeSteps?: string[]`.
- **Bounce shape (audit BLOCKER/REAL-GAP):** a *dedicated* result with an explicit discriminant, NOT
  the started-cycle schema (whose required fields would make a naive `parse` throw on a bounce). E.g.
  `{ data: { bounce: "confirm-steps" | "unknown-steps", cycle, steps: [full list], message,
  unknownSteps? } }`. The agent tests `data.bounce` presence to know it must stop and relay, not treat
  the cycle as started. The two start-tool descriptions say so explicitly.
  - **Absent** -> `bounce: "confirm-steps"`, no sidecar written, `message` = "This is the cycle that
    will run. Full suite unless you skip some: 1. <step> ... **Show this to the user and ask which
    steps to skip; do not choose for them.** Re-call includeSteps with the kept steps." (explicit ASK,
    so an autonomous agent does not self-select).
  - **Any unknown id** -> `bounce: "unknown-steps"`, returning the full static valid-step list;
    **rejects the whole call** (no partial proceed - never silently drop a typo'd step); the message
    echoes the recognized ids so the re-call is a small edit.
  - **All valid** -> proceed.
- **Escape hatch:** accept `includeSteps: ["all"]` = full suite, skip the bounce. Keeps the common
  case to one extra call and survives compaction (no reliance on the agent's in-session memory).

### The core runtime change: per-run step sequence

- **Add `steps?: z.array(z.string().min(1)).min(1).optional()` to `baseProgressFields`** in
  `ProgressSchema` (audit BLOCKER: the current `z.object` strips unknown fields, so a `steps` written
  but not in the schema is dropped on the next read and erased on the next write - the feature
  no-ops). Optional, absent on old sidecars (back-compat via `?? def.steps`).
- Effective list = `progress.steps ?? def.steps`, used by **all six consumers** (the first draft
  missed two): `loadCycleRun` (returns it), `cycleNext`, `cycleCheckpoint` (advance/applyLoop),
  **`cycleGoto`** (findStep + `effective.indexOf`, NOT `def.steps.indexOf`), **`cycleStatus`** (`total`
  and `includes` against the effective list).
- `index` is **subset-relative** everywhere. lapEnd fires on the effective list's last step (omit
  `commit` -> lap ends after the last kept step). `advance`/`applyLoop` already take `steps` as a
  param, so the compute layer needs no change - only the callers pass the effective list.
- `cycleGoto` to a step that is real in the def but NOT in the run's subset (a skipped step) -> do NOT
  reject. **Auto-advance** to the next included step at or after that step's def position (clamp to the
  last included step if none follows), and prefix the returned instructions with
  `(auto-advanced from <the skipped step>)\n` so the agent knows the goto landed past a skipped step.
  (A target not in the def at all still returns the unknown-step static list.)
- Subset validation: canonicalize ids case-insensitively (reuse `findStep`), dedup, and persist the
  **def-filtered slice** (`def.steps.filter(s => kept.has(canon(s)))`) so order is the def's canonical
  order by construction. `.min(1)` schema backstop.

### Unknown-step response (simple for now)

- On any unknown id, the `bounce: "unknown-steps"` result just returns the full **static list** of the
  def's valid step names ("unrecognized: <bad>; valid steps are: implement, align, framework,
  red-team, compliance, commit"). No fuzzy matching for now (a Levenshtein "did you mean" can come
  later); the static list is enough for the agent to correct the call.

### Composition (Feature 1 x Feature 2)

- Orthogonal axes (which steps run vs which phases/items the work covers). A phases run can carry
  `includeSteps`; `includeSteps` drives the per-phase/per-batch step loop through the same effective
  `steps` variable (per-batch wrap goes to the subset's first step).
- **Precedence on a malformed start: validate phases FIRST (hard error), THEN the step bounce** - do
  not prompt for steps on a run whose phases are bogus, and do not run the (file-reading) phase
  validation when a cheaper step bounce would fire anyway... so: phases error first if present.

### Step content

- Author ONE new step into `audited-implementation.md`: **`compliance`** (uses the `/compliance` skill:
  SOC2/GDPR/CPRA), ordered `[implement, align, framework, red-team, compliance, commit]`. Analysis
  first, no edits: dispatch Agent(opus) running `/compliance`, report only, triage gate, then close the
  real gaps.
- Authoring constraint: the frontmatter slug and the `## ` heading must normalize-match exactly or
  `loadCycleDef` fails the whole def. Authored as part of this feature (lands with `includeSteps`) so
  it is skippable from day one.

### Tests

- Feature 1: cold `cycleStatus` injects the section body; label-vs-header validation (match; mismatch
  -> did-you-mean with real headers); `mode: "phases"` surfaced by status; plan-path addressing.
- Feature 2: `steps?` survives a read+advance round-trip (the schema fix); a subset run advances only
  kept steps and lapEnds on the last kept step; `cycleGoto`/`cycleStatus` use the subset (total/index
  correct); goto-to-skipped rejected; absent includeSteps -> `bounce:"confirm-steps"` + no sidecar;
  unknown id -> `bounce:"unknown-steps"` (mixed valid/invalid rejects whole); `["all"]` escape;
  composition precedence (invalid phases + absent includeSteps -> phase error first).
- Def-load: `audited-implementation` loads with the 6-step list including `compliance`.

### Open / defer

- Persistent per-user step preferences: defer; the `["all"]` token + in-session memory cover the
  common cases.
- Append-to-phases (a path-addressed entry point that re-validates against the plan): defer unless
  needed.
