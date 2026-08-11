---
steps: [implementation-phase, align-fan-out, align-fix, red-team-fan-out, red-team-fix, implementation-commit, architecture-fan-out, architecture-fix, architecture-commit, compliance-fan-out, compliance-fix, compliance-commit, documentation, crust-collection, plan-completeness]
---

# Audited Phase Implementation

Implement a plan phase with multiple audits. Each lap implements, then audits from multiple angles, fixing and commit amending in between audits, repeating until the phase is solid. The plan file is the document being implemented; its body churns each lap while these steps stay fixed.

`compliance-*` is suitable only if this is enterprise software, where the developer is concerned about safety PII. Typically skip it for personal projects.



## implementation-phase

Implement the phase. Complex code -> handle yourself. Have a TeamCreate() team? Delegate to team agents only if the task is so simple they cannot fail.

If `switchboard_capabilities` list **Task Board**, use Switchboard `taskBoard*` series of tools instead of vanilla Claude `TaskCreate`/`TaskUpdate`. Else, use vanilla Task series. Maintain the task board frequently to show active progress. Recommended to build the full phase listing and their nested slices in Task Board, so the whole plan is visible from the app.

Be sure to fan out a Sonnet Workflow audit pass on every modified file or range. Violators of /coding guidelines. Especially overly long comments, narrative comments, and units that test plain internal states instead of behavior. They report, you fix if real.



## align-fan-out

**Analysis only.** Plan alignment audit. Fan out via `Workflow()`.

Vet the implementation for misalignments from the plan:
- Fan out with `parallel()`/`pipeline()`; Pass each their angle. Each agent git diffs on their own.
- Adjust Agent count to complexity. Choose between 4 to 12 per fan out. Explicitly choose a model:
  - If `switchboard_capabilities` list **Codex**, use Luna for all types of *fan outs* (like Explore/Analyze/Audit/Edits), and Opus for *joins* (Synthesis).
  - Else, use Sonnet for **light** fact checks and exploration, Opus for complex reasoning.
- If **Lexicon** MCP plugin is enabled, have them use it over bare Find/Grep.
- Give each a markdown Report format.
- Synthesis: Dedup across dimensions, rank survivors.

Post Workflow triage gate: Real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

## align-fix

Fix real misalignments and run smoke tests (run editor/game instances, introspection checks, screenshots, etc). Have a team? If it is their role, ask them to unit-test or smoke run.

/coding skill hygiene. Especially **Comments Must be Timeless** and reduce massive comments.
Don't forget to smoke test after changes.

If a fix changed anything, `cycleGoto(...)` back to `align-fan-out` to re-audit. If fixes are giving diminishing returns, advance with `next()` instead.



## red-team-fan-out

**Analysis only.** Red team audit. Fan out via `Workflow()`.

Vet the implementation for gaps, blockers, concerns:
- Fan out with `parallel()`/`pipeline()`; Pass each their angle. Each agent git diffs on their own.
- Adjust Agent count to complexity. Choose between 4 to 12 per fan out. Explicitly choose a model:
  - If `switchboard_capabilities` list **Codex**, use Luna for all types of *fan outs* (like Explore/Analyze/Audit/Edits), and Opus for *joins* (Synthesis).
  - Else, use Sonnet for **light** fact checks and exploration, Opus for complex reasoning.
- If **Lexicon** MCP plugin is enabled, have them use it over bare Find/Grep.
- Give each a markdown Report format.
- Synthesis: Dedup across dimensions, rank survivors.

Post Workflow triage gate: Real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

## red-team-fix

Fix the real issues and run smoke tests again. Watch out for: yes-manning, scope creep, drift from codebase patterns.

**Same bug twice is a design bug:** Note which mechanism each fix lands in. The second or third time you patch the same defect class in the same mechanism, that is a /architecture violation, not bad luck. Stop trying to fix it properly here. Land the smallest patch that keeps the phase green, then append it under a `### Bug Classes` heading inside the current phase's section of the plan file, creating that heading if it is not there yet: the mechanism, the defect class, and what each round patched. Save the fix for `architecture-fan-out`, or raise it to `crust-collection`.

/coding skill hygiene. Especially **Comments Must be Timeless** and reduce massive comments.
Don't forget to smoke test after changes.

If a fix changed anything, `cycleGoto(...)` back to `red-team-fan-out` to re-audit. If fixes are giving diminishing returns, advance with `cycleNext` instead.



## implementation-commit

If this project is git tracked, gitStage + gitCommit.

Commit description rules: One short phrase or sentence. Start with a verb. Describe only what changed, not process.
- No prefixes or tags, "feat:", "chore:", "wip:", "[sandbox]".
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Do not use words like "fix" unless the human has confirmed the change is the correct solution; for unverified attempts, use words like "attempt" or "try" instead. This rule also goes double when you end and report to user.
- If related to issues, end with (fixes #N) for bugfixes, (closes #N) for completed tasks, (related #N) to link without closing.
- If you had to PR, don't forget to switch to main, await, and pull.



## architecture-fan-out

**Analysis only.** Architecture audit. Fan out via `Workflow()`.

**Skipping is allowed.** If you have come through here enough times and what is in front of you is already solid, `cycleNext` straight past rather than manufacturing work.

Vet the implementation for architectural improvements using the /architecture skill. You can now deviate from the plan, but do respect its goal:
- Fan out with `parallel()`/`pipeline()`; Pass each a list of relevant sections and their angle.
- Adjust Agent count to complexity. Choose between 4 to 12 per fan out. Explicitly choose a model:
  - If `switchboard_capabilities` list **Codex**, use Luna for all types of *fan outs* (like Explore/Analyze/Audit/Edits), and Opus for *joins* (Synthesis).
  - Else, use Sonnet for **light** fact checks and exploration, Opus for complex reasoning.
- If **Lexicon** MCP plugin is enabled, have them use it over bare Find/Grep.
- Give each a markdown Report format.
- Synthesis: Dedup across dimensions, rank survivors.

Anything under the current phase's `### Bug Classes` heading is required input, not a candidate. Red team already proved that class recurs, so it enters the ranking as a redesign target and the fan-out only decides the shape of the fix.

Post Workflow triage gate: Real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

**Optional:** If you've noticed Agents fabricating wrong facts, sus out why. Poorly named function/class names? Stale comments? Anything that could be **misleading** them? Weigh these into the architecture assessment as something to fix, when you notice the issue.

## architecture-fix

Apply the top chunk `architecture-fan-out` handed you.

/coding skill hygiene. Especially **Comments Must be Timeless** and reduce massive comments.
Don't forget to smoke test after changes.

**Reconcile the plan with what shipped.** This step is licensed to deviate, so slices you already marked `✅` may no longer describe the code. Rewrite those sections to match what is actually there. The plan is the record of what was built, not what was intended, and a stale `✅` means the next lap audits against a spec that no longer exists.

**Then hand it to red team.** A refactor is unproven until something hostile has looked at it. `cycleGoto(...)` to `red-team-fan-out`. Step order brings you back through here, and `architecture-fan-out` can wave you past when nothing is left worth doing.

## architecture-commit

If this project is git tracked, gitStage + gitCommit.

Commit description rules: One short phrase or sentence. Start with a verb. Describe only what changed, not process.
- No prefixes or tags, "feat:", "chore:", "wip:", "[sandbox]".
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Do not use words like "fix" unless the human has confirmed the change is the correct solution; for unverified attempts, use words like "attempt" or "try" instead. This rule also goes double when you end and report to user.
- If related to issues, end with (fixes #N) for bugfixes, (closes #N) for completed tasks, (related #N) to link without closing.
- If you had to PR, don't forget to switch to main, await, and pull.



## compliance-fan-out

**Analysis only.** Compliance audit. Fan out via `Workflow()`.

**Skipping is allowed.** If you have come through here enough times and what is in front of you is already solid, `cycleNext` straight past rather than manufacturing work.

Vet the implementation for compliance gaps using the /compliance skill:
- Fan out with `parallel()`/`pipeline()`; Pass each a list of relevant sections and their angle.
- Adjust Agent count to complexity. Choose between 4 to 12 per fan out. Explicitly choose a model:
  - If `switchboard_capabilities` list **Codex**, use Luna for all types of *fan outs* (like Explore/Analyze/Audit/Edits), and Opus for *joins* (Synthesis).
  - Else, use Sonnet for **light** fact checks and exploration, Opus for complex reasoning.
- Access control, data handling/classification, audit trails, retention, data-subject rights
- SOC2/GDPR/CPRA
- If **Lexicon** MCP plugin is enabled, have them use it over bare Find/Grep.
- Give each a markdown Report format.
- Synthesis: Dedup across dimensions, rank survivors, split into small (fix now) or large redesign (defer).

Post Workflow triage gate: Real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

## compliance-fix

Apply the small fixes `compliance-fan-out` flagged.

/coding skill hygiene. Especially **Comments Must be Timeless** and reduce massive comments.
Don't forget to smoke test after changes.

**Reconcile the plan with what shipped.** Slices you already marked `✅` may no longer describe the code. Rewrite those sections to match what is actually there. The plan is the record of what was built, not what was intended, and a stale `✅` means the next lap audits against a spec that no longer exists.

**Then hand it to red team.** A fix is unproven until something hostile has looked at it. `cycleGoto(...)` to `red-team-fan-out`. Step order brings you back through here, and `compliance-fan-out` can wave you past when nothing is left worth doing.

Large-redesign items: report them to the human for a later plan, but only at the very end after the plan is fully accounted for (`done`). Don't break out of the cycles just to report.

## compliance-commit

If this project is git tracked, gitStage + gitCommit.

Commit description rules: One short phrase or sentence. Start with a verb. Describe only what changed, not process.
- No prefixes or tags, "feat:", "chore:", "wip:", "[sandbox]".
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Do not use words like "fix" unless the human has confirmed the change is the correct solution; for unverified attempts, use words like "attempt" or "try" instead. This rule also goes double when you end and report to user.
- If related to issues, end with (fixes #N) for bugfixes, (closes #N) for completed tasks, (related #N) to link without closing.
- If you had to PR, don't forget to switch to main, await, and pull.



## documentation

Update `docs/` and jsdoc/tsdoc/etc above major functional systems and classes. And cleanup comments according to /coding rules and update docs if needed.

General rules:
- Must be clear enough that human can skim and take over. Clear, but not dense.
- Don't dupe docs. You don't need massive detail repeated in both docs/ and code docs. Just point them to the file and class name or something.
- Don't include plan/cycle/slice/lap labels or progress narrative anywhere, e.g. "(slice 4)", "(some phase name)", "[sandbox] Testing things",.
- Don't mention line numbers. Those are moving targets. Mention names instead (function names, class names, etc).
- Fix documentation violations as you come across them.

If you need to mention a line number, use **Reference format:** `FilePath:Namespace:ClassOrFunctionName[:VariableName...]`. Or  describe where.



## crust-collection

If the session has not been going long enough, or you recently just went through a compaction, `next()` out of this pass. Do this pass only if you've *felt* the codebase enough. As you are approaching the final phases of the plan, or you just had a really annoying reoccuring quirk that you had to painfully derive a solution to.

As opposed to /architecture, crust sweep is about recording things you hated about the codebase. This is not a code audit, it's a vibe check. Pain points can be described straight from your head, but do reanalyze to capture file references and steps that causes the pain points, or where classes of anti-patterns reside.

It's also OK to just say this plan went perfectly with no pain points: Niche cases, diminishing improvements, and things that are not worth my time and tokens to bring up.

Don't fix anything. Just write it to a `## Painpoints` section towards the end of the plan file pointing them out.
If you need to mention a line number, use **Reference format:** `FilePath:Namespace:ClassOrFunctionName[:VariableName...]`. Or  describe where.



## plan-completeness

Audit what part of the plan is incomplete. In the plan file, mark completed phases and slices with `✅`.

If there is:
- Unfinished work in this current phase: `cycleGoto` back to the `implementation-phase`.
- Critical issue that stops progress entirely, `cycleCheckpoint` to checkpoint with `critical-stop`. Discuss the problem.
- More phases in the plan to complete: `cycleCheckpoint` with `loop`.
- Actually factually done? `cycleCheckpoint` with `done`.
- Minor issues and discrepancies that you normally would stop for, report it and continue on. Don't pause and hold for minor issues or questions. Accumulate the laundry list of findings until the very end as part of the final report, or queue it up for the next architecture pass.

**Task Board** or **Task** tools series. Keep your task list current.

Report the outcome to the human:
- If you are in a channel conversation (you have a `session_id` from the inbound `<channel>` message), reply on that channel via `channel_reply` so the report lands where they are talking to you.
- If you weren't in a conversation but have `notify_human` tool, use that.
- Otherwise, just output the report to the usual terminal as normal.

Green-commit discipline makes grinding through all phases safe even if you're interrupted. And because we capture everything said and decisions made in the plan file, you never have to concern yourself about approaching the session compaction limit. Just drive your bicycle over that line. You'll be fine.

It causes more harm than good to stop mid-plan to wait for yet another approval to resume:
- ❌ Codebase half unfinished state.
- ❌ Context losses from derailing.
- ❌ Confusion from course changes that no longer match the vetted plan.
- ❌ Lost time because you lied about continuing but you actually paused to wait for some go ahead to resume for an hour.

TLDR: Don't pause. Don't park. Don't stop. **Don't say "Continuing" and then immediately silently stop** (I'm looking at YOU, Opus). Resume until all phases of the plan is complete. Thank you.
