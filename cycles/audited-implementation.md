---
steps: [implementation-phase, align-fan-out, align-fix, red-team-fan-out, red-team-fix, implementation-commit, framework-fan-out, framework-fix, framework-commit, compliance-fan-out, compliance-fix, compliance-commit, documentation, crust-collection, plan-completeness]
---

# Audited Phase Implementation

Implement a plan phase with multiple audits. Each lap implements, then audits from multiple angles, fixing and committing in between audits, repeating until the phase is solid. The plan file is the document being implemented; its body churns each lap while these steps stay fixed.



## implementation-phase

Implement the phase. Complex code -> handle yourself. Have a team? Delegate to team agents only if the task is so simple they cannot fail.

Be sure to fan out a Sonnet Workflow audit pass on every modified file or range. Violators of /coding guidelines. Especially overly long comments, narrative comments, and units that test plain internal states instead of behavior. They report, you fix if real.



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

/coding skill hygiene. Especially **Comments Must be Timeless**.
Don't forget to smoke test after changes.

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

/coding skill hygiene. Especially **Comments Must be Timeless**.
Don't forget to smoke test after changes.

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

/coding skill hygiene. Especially **Comments Must be Timeless**.
Don't forget to smoke test after changes.

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

/coding skill hygiene. Especially **Comments Must be Timeless**.
Don't forget to smoke test after changes.

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



## crust-collection

If the session has not been going long enough, `next()` out of this pass. Do this pass as you are nearing the final phases of the plan. Or just had a really annoying reoccuring quirk that you had to painfully derive a solution to.

This is exactly the right moment for a crust sweep. As opposed to /framework-first-design, crust collection is about recording things you hated about the codebase. Most pain points can be answered straight from your head. Skip diminishing improvements: It's OK to just say this plan went perfectly with no pain points.

Collect points in code where bug classes reside: `filepath : namespace : name` (not line numbers)
Don't fix anything. Just write it to a `## Painpoints` section towards the end of the plan file pointing them out.



## plan-completeness

Audit what part of the plan is incomplete. If there is:
- Unfinished work in this current phase: `cycleGoto` back to the `implementation-phase`.
- More phases in the plan to complete: `cycleCheckpoint` to checkpoint with `loop`.

If there was a critical issue that stops progress entirely, `cycleCheckpoint` to checkpoint with `critical-stop`. Discuss the problem.

Report the outcome to the human. If you are in a channel conversation (you have a `session_id` from the inbound `<channel>` message that started this run), reply on that channel via `channel_reply` so the report lands where they are talking to you. Only for a detached fire with no such conversation (e.g. a cron) use `notify_human` if it exists. Otherwise, just output your report as you normally would.

Green-commit discipline makes grinding through all phases safe even if you're interrupted. And thanks to capturing everything said and decisions made in the plan file, you never have to concern yourself about approaching the session compaction limit. Just drive your bicycle over that line. You'll be fine.

It causes more harm than good to stop mid-plan and ask for permission to resume:
- ❌ Codebase half unfinished state.
- ❌ Context losses from derailing.
- ❌ Confusion from course changes that no longer match the vetted plan.
- ❌ Lost time because you lied about continuing but you actually paused to ask for permission to resume.

If there are minor issues and discrepancies that you normally would stop for, report it and continue on. Don't pause and hold for minor issues or questions. Accumulate the laundry list of findings until the very end as part of the final report, when cycles completely finishes and every phase sealed.

TLDR: **Do not pause. Do not park. Do not hold. Do not stop. Do not derail. Only continue and resume until plan is complete.**
