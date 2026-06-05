---
steps: [implement, align, framework, red-team, compliance, commit]
---

# Audited Phase Implementation

Implement a plan one phase at a time. For each phase: implement, then harden it through alignment,
framework, and red-team passes before committing. Each audit pass analyzes and triages with NO edits
first, then applies only the real findings.

## implement

Implement the phase. /coding skill hygiene. Complex code -> handle yourself. Have a team? Delegate
to team agents only if the task is so simple they cannot fail.

## align

Analysis first, no edits: plan alignment audit. Dispatch Agent(opus) -> compare the implementation
vs the questionaire and the plan. Report only, no edits. The agent runs its own `git diff` (no
paste; the fresh-diff rule). Triage gate: real deviation vs plan ambiguity / intentional
refinement. A confident tone is not evidence; verify against the code.

Then fix the real misalignments and run smoke tests (run editor/game instances, introspection
checks, screenshots, etc). Have a team? If it is their role, ask them to unit-test or smoke run.
If a fix changed anything, re-run the audit; repeat until it comes back clean.

## framework

Analysis first, no edits: /framework-first-design skill. Dispatch Agent(opus) -> catch code crust,
antipatterns, dupes, pain points, whatever. Triage gate: real gap vs overcautious / out-of-scope /
hallucinated.

Then apply only the real findings, most significant first, scoped to one coherent committable chunk.

## red-team

Analysis first, no edits: pick audit angles to vet the implementation for gaps, and dispatch one
parallel Agent(opus) per angle. Scale breadth to change size (2 focused for a small delta, or more
than 4 for a massive rewrite):

- Each gets: the issue/finding context + their angle.
- Report only, no edits.
- The fresh-diff rule applies.

Triage gate each report on arrival: real gap vs overcautious / out-of-scope / hallucinated.

Then fix the real issues and run smoke tests again. Watch out for: yes-manning, scope creep, drift
from codebase patterns. If you fixed anything, re-run the red team; repeat until it comes back clean.

## compliance

Analysis first, no edits: /compliance skill (SOC2/GDPR/CPRA). Dispatch Agent(opus) running /compliance
to audit the implementation for compliance gaps: access control, data handling/classification, audit
trails, retention, data-subject rights. Report only, no edits. Triage gate: real gap vs out-of-scope /
overcautious.

Then close the real gaps. If a fix changed anything, re-run the audit; repeat until it comes back
clean.

## documentation

Update `docs/` and jsdoc/tsdoc/etc above major functional systems and classes. And cleanup comments according to /coding rules and update docs if needed.

General rules:
- Must be clear enough that human can skim and take over. Clear, but not dense.
- Don't dupe docs. You don't need massive detail repeated in both docs/ and code docs. Just point them to the file and class name or something.
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Don't mention line numbers. Those are moving targets. Mention names instead (function names, class names, etc).
- Fix documentation violations as you come across them.

## commit

If this project is git tracked, gitStage + gitCommit.

On a resumed batch the work may already be partly done: check gitStatus first.

Commit description rules: One short phrase or sentence. Start with a verb. Describe only what changed, not process.
- No prefixes or tags, "feat:", "chore:", "wip:", "[sandbox]".
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Do not use words like "fix" unless the human has confirmed the change is the correct solution; for unverified attempts, use words like "attempt" or "try" instead. This rule also goes double when you end and report to user.
- If related to issues, end with (fixes #N) for bugfixes, (closes #N) for completed tasks, (related #N) to link without closing.

## framework-loop

If framework-first issues still remain, `cycleGoto(...)` back to `framework` now instead of indefinitely shelving it.

Otherwise end the phase with `cycleNext`.
