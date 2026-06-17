---
steps: [implement-phase, align-fan-out, align-fix, red-team-fan-out, red-team-fix, implementation-commit, framework-fan-out, framework-fix, framework-commit, compliance-fan-out, compliance-fix, compliance-commit, documentation, plan-completeness]
---

# Audited Phase Implementation

Implement a plan phase with multiple audits. Each lap implements, then audits from multiple angles, fixing and committing in between audits, repeating until the phase is solid. The plan file is the document being implemented; its body churns each lap while these steps stay fixed.



## implement-phase

Implement the phase. /coding skill hygiene. Complex code -> handle yourself. Have a team? Delegate to team agents only if the task is so simple they cannot fail.



## align-fan-out

**Analysis only.** Plan alignment audit. Fan out via `Workflow()`.

Vet the implementation for misalignments from the plan:
- `export const meta = {...}`, then a `DIMENSIONS` array (one entry per audit angle).
- Fan out with `parallel()`/`pipeline()`; pass each a fresh git diff.
- As many agents as you need. 8 to 20+ per parallel/pipeline Explore/Verify type phase.

Triage gate: real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

Then rank the survivors, most significant first.

## align-fix

Then fix real misalignments and run smoke tests (run editor/game instances, introspection checks, screenshots, etc). Have a team? If it is their role, ask them to unit-test or smoke run.

Don't forget /coding rules and to smoke test after changes.

If a fix changed anything, `cycleGoto(...)` back to `align-fan-out` to re-audit. If fixes are giving diminishing returns, advance with `next()` instead.



## red-team-fan-out

**Analysis only.** Red team audit. Fan out via `Workflow()`.

Vet the implementation for gaps, blockers, concerns:
- `export const meta = {...}`, then a `DIMENSIONS` array (one entry per audit angle).
- Fan out with `parallel()`/`pipeline()`; pass each a fresh git diff.
- As many agents as you need. 8 to 20+ per parallel/pipeline Explore/Verify type phase.

Triage gate: real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

Then rank the survivors, most significant first.

## red-team-fix

Then fix the real issues and run smoke tests again. Watch out for: yes-manning, scope creep, drift from codebase patterns.

Don't forget /coding rules and to smoke test after changes.

If you fixed anything, `cycleGoto(...)` back to `red-team-fan-out` to re-audit. If fixes are giving diminishing returns, advance with `next()` instead.



## implementation-commit

If this project is git tracked, gitStage + gitCommit.

Commit description rules: One short phrase or sentence. Start with a verb. Describe only what changed, not process.
- No prefixes or tags, "feat:", "chore:", "wip:", "[sandbox]".
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Do not use words like "fix" unless the human has confirmed the change is the correct solution; for unverified attempts, use words like "attempt" or "try" instead. This rule also goes double when you end and report to user.
- If related to issues, end with (fixes #N) for bugfixes, (closes #N) for completed tasks, (related #N) to link without closing.



## framework-fan-out

**Analysis only.** Framework-first audit. Fan out via `Workflow()`.

Vet the implementation for framework-first improvements using /framework-first-design skill. You can now deviate from the plan, but do respect its goal:
- `export const meta = {...}`, then a `DIMENSIONS` array (one entry per audit angle).
- Fan out with `parallel()`/`pipeline()`; pass each a list of relevant sections.
- As many agents as you need. 8 to 20+ per parallel/pipeline Explore/Verify type phase.

Triage gate: real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

Then rank the survivors most significant first, grouped into coherent committable chunks.

## framework-fix

Then apply the top chunk `framework-fan-out` handed you.

Don't forget /coding rules and to smoke test after changes.

If a fix changed anything, `cycleGoto(...)` back to `framework-fan-out` to re-audit. If fixes are giving diminishing returns, advance with `next()` instead.

## framework-commit

If this project is git tracked, gitStage + gitCommit.

Commit description rules: One short phrase or sentence. Start with a verb. Describe only what changed, not process.
- No prefixes or tags, "feat:", "chore:", "wip:", "[sandbox]".
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Do not use words like "fix" unless the human has confirmed the change is the correct solution; for unverified attempts, use words like "attempt" or "try" instead. This rule also goes double when you end and report to user.
- If related to issues, end with (fixes #N) for bugfixes, (closes #N) for completed tasks, (related #N) to link without closing.



## compliance-fan-out

**Analysis only.** Compliance audit. Fan out via `Workflow()`.

Vet the implementation for compliance gaps using the /compliance skill:
- `export const meta = {...}`, then a `DIMENSIONS` array (one entry per audit angle).
- Fan out with `parallel()`/`pipeline()`; pass each a list of relevant sections.
- As many agents as you need. 8 to 20+ per parallel/pipeline Explore/Verify type phase.
- Access control, data handling/classification, audit trails, retention, data-subject rights
- SOC2/GDPR/CPRA

Triage gate: real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

Then rank the survivors most significant first, split into small (fix now) or large redesign (defer).

## compliance-fix

Then apply the small fixes `compliance-fan-out` flagged.

Don't forget /coding rules and to smoke test after changes.

If a fix changed anything, `cycleGoto(...)` back to `compliance-fan-out` to re-audit. If fixes are giving diminishing returns, advance with `next()` instead.

Large-redesign items: report them to the human for a later plan, but only at the very end after the plan is fully accounted for (`done`). Don't break out of the cycles just to report.

## compliance-commit

If this project is git tracked, gitStage + gitCommit.

Commit description rules: One short phrase or sentence. Start with a verb. Describe only what changed, not process.
- No prefixes or tags, "feat:", "chore:", "wip:", "[sandbox]".
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Do not use words like "fix" unless the human has confirmed the change is the correct solution; for unverified attempts, use words like "attempt" or "try" instead. This rule also goes double when you end and report to user.
- If related to issues, end with (fixes #N) for bugfixes, (closes #N) for completed tasks, (related #N) to link without closing.



## documentation

Update `docs/` and jsdoc/tsdoc/etc above major functional systems and classes. And cleanup comments according to /coding rules and update docs if needed.

General rules:
- Must be clear enough that human can skim and take over. Clear, but not dense.
- Don't dupe docs. You don't need massive detail repeated in both docs/ and code docs. Just point them to the file and class name or something.
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Don't mention line numbers. Those are moving targets. Mention names instead (function names, class names, etc).
- Fix documentation violations as you come across them.



## plan-completeness

Audit what part of the plan is incomplete. If there is unfinished work, finish this step with `loop` and finish the work on the next loop. Prefer doing all autonomous work you can do now.

If it presents a critical issue that you cannot resolve by looping, it is a `critical-stop`.
