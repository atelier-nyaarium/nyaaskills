---
steps: [propose, audit-fan-out, audit-rethink]
---

# Plan Refinement

Hardens a plan or idea by repeating propose / audit / triage / rethink until it converges. Each lap proposes, audits from multiple angles, triages the findings, and rethinks, repeating until the plan feels solid. The plan file is the document being refined; its body churns each lap while these steps stay fixed.



## propose

Propose or refine the plan. Write the current state back into the plan file this cycle was started on. If a proposal already exists (e.g. from the questionaire), you may conclude this step immediately.



## audit-fan-out

**Analysis only.** Plan audit. Fan out via `Workflow()`.

Vet the plan for gaps, blockers, concerns:
- Fan out with `parallel()`/`pipeline()`; Pass each their angle. Point each at the plan.
- Adjust Agent count to complexity. Choose between 4 to 12 per fan out. Explicitly choose a model:
  - If `switchboard_capabilities` list **Codex**, use Luna for all types of *fan outs* (like Explore/Analyze/Audit/Edits), and Opus for *joins* (Synthesis).
  - Else, use Sonnet for **light** fact checks and exploration, Opus for complex reasoning.
- Give each a schema so it returns data, not prose.
- Synthesis: Dedup across dimensions, rank survivors.

Post Workflow triage gate: Real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

## audit-rethink

Rethink and edit plan. Plan changed? Update the plan. Watch out for: yes-manning, scope creep, heavy drift (ask the human on large drifts).

When the plan feels solid, `cycleCheckpoint` to checkpoint with `done` and give a final report to the channel; otherwise `loop` for another lap. A critical issue you cannot resolve in-loop is a `critical-stop` (you may /questionaire again).
