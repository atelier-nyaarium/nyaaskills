---
steps: [propose, audit, triage, rethink]
maxLaps: 8
---

# Plan Refinement

Hardens a plan or idea by repeating propose / audit / triage / rethink until it converges. Each lap
proposes, audits from multiple angles, triages the findings, and rethinks, repeating until the plan
feels solid. The plan file is the document being refined; its body churns each lap while these steps
stay fixed.

## propose

Propose or refine the plan. Write the current state back into the plan file this cycle was started
on. If a proposal already exists (e.g. from the questionaire), you may conclude this step
immediately.

## audit

Analysis only, no edits: pick audit angles to vet the plan for gaps, blockers, concerns, and
dispatch one parallel Agent(opus) per angle. Scale breadth to change size (2 focused for a small
delta, or more than 4 for a massive rewrite):

- Point them at the plan.
- Give the angle. Report only, no edits.

## triage

Triage each report on arrival. Real gap vs overcautious / out-of-scope / hallucinated? Re-think.

## rethink

After all return, rethink. Plan changed? Update the plan. Watch out for: yes-manning, scope creep,
heavy drift (ask the human on large drifts).

End the lap: call `cycleCheckpoint(...)` with one of

- `done` - the plan feels solid; give a final report to the channel
- `loop` - refine for another lap
- `critical-stop` - a critical issue you cannot resolve in-loop (you may /questionaire again)
