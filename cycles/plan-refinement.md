---
steps: [propose, audit-fan-out, audit-rethink]
---

# Plan Refinement

Hardens a plan or idea by repeating propose / audit / triage / rethink until it converges. Each lap proposes, audits from multiple angles, triages the findings, and rethinks, repeating until the plan feels solid. The plan file is the document being refined; its body churns each lap while these steps stay fixed.



## propose

Propose or refine the plan. Write the current state back into the plan file this cycle was started on. If a proposal already exists (e.g. from the questionaire), you may conclude this step immediately.



## audit-fan-out

**Analysis only.** Plan audit. Fan out Agents.

Vet the plan for gaps, blockers, concerns:
- Point them to the plan.

Triage gate: real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

## audit-rethink

Rethink and edit plan. Plan changed? Update the plan. Watch out for: yes-manning, scope creep, heavy drift (ask the human on large drifts).

When the plan feels solid, finish with `done` and give a final report to the channel; otherwise `loop` for another lap. A critical issue you cannot resolve in-loop is a `critical-stop` (you may /questionaire again).
