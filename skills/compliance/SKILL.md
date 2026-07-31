---
name: compliance
description: Scopes which of SOC 2, GDPR, and CPRA actually apply, then closes real gaps one at a time with evidence a reviewer can verify. Load this skill when compliance is on the table; audits, data subject rights, deletion and retention, access control, consent, or privacy regulation.
---

# Compliance

A control that exists only in a policy doc is not a control.

The bar is one place:

- "Who can access this?" answered by reading one file.
- "Was it accessed, by whom, and why?" answered by one query.
- "Did the deletion actually delete?" answered by running it.

If it takes a grep across handlers to answer, the control is broken no matter what the policy says.

Two things separate this from other quality work. Some gaps are live violations right now rather than debt. And the human signs, not you.

## You Are Not Their Lawyer

Whether a regulation applies to a business is a legal determination, and you do not make it.

What you can do: read the code, say what data it holds and where that data flows, and name what would be a problem *if* a given regulation applies. Hand applicability to the human and their counsel.

Never tell a user they are compliant. Tell them what you verified and what you did not.

## Scope It First

Do not assume all three apply. Most projects are subject to fewer than they fear, and building GDPR deletion machinery for an app with no EU users is wasted work.

- **GDPR** - do you offer goods or services to people in the EU or EEA, or monitor their behavior there? Where the company sits does not matter. Where the users sit does.
- **CPRA** - a for-profit doing business in California *and* over at least one threshold: $25M+ gross revenue, personal info of 100k+ consumers or households, or 50%+ of revenue from selling or sharing personal info. Under all three and it does not apply at all.
- **SOC 2** - not a law. Nobody is ever "in violation" of SOC 2. It is a voluntary attestation pursued because a customer contract or an enterprise deal demands it. If nobody is asking for the report, there is nothing here to fail.

❓ Ask the human which of these are actually live, and why. "A customer wants a Type II report" and "we just opened EU signups" lead to completely different work.

Ask what else is in play, too. This skill covers three regimes. These are outside it:

- Health data -> HIPAA
- Card data -> PCI-DSS
- Users under 13 -> COPPA
- Public company financials -> SOX

If one of those is in the picture, say so and stop rather than guessing at it.

## Live Violation vs Hardening

Sort every finding into one of these before planning any work.

**Live violation.** The obligation exists and is being broken right now. Deletion requests that never reach the warehouse. PII retained past its lawful basis. GPC signals ignored. No breach detection feeding the GDPR 72-hour clock.

There is nothing to weigh. It gets fixed, and it gets a clean break. There is no backwards compatibility for illegal data handling, and no legacy path preserved when the legacy path is the violation.

**Hardening.** The obligation is met, but the control is scattered, undemonstrable, or fragile. Authz checks inline across forty handlers. Retention that happens because someone remembers to run a script. A classification table in a doc that nothing reads.

This one is a real tradeoff. It competes with everything else on the roadmap, and the human decides when it is worth doing.

Live violations outrank all hardening, always.

## Spawning Agents

Delegate rather than doing the work yourself. Use whichever spawn tool the environment provides: Agent, Task, or runSubagent.

- Team lead with an active team from `CreateTeam` -> the `team-*` series.
- Otherwise -> the `subagent-*` series.

So "delegate to `compliance-assessor`" means `team-compliance-assessor` or `subagent-compliance-assessor`.

Pass the scope you established above: which regulations are live, why, and what is explicitly out. Without it the assessor audits all three and hands back findings for regulations that do not apply.

## The Loop

**1. Assess.** Delegate to `compliance-assessor`. It already knows what dimensions to audit, so do not restate its checklist. Give it the regulatory scope and any specific concern the user raised.

It returns ranked gaps and recommends one. Require a plain answer to: what here is a live violation, and what is hardening?

Review with the user before acting on anything.

**2. Pick the approach.** From the recommended gap:

- **Live-violation remediation** - clean break on the offending data path.
- **Control surface build** - the rule is scattered. Build the one place, migrate the call sites, delete the strays.
- **Audit-readiness** - the control works but a reviewer cannot see it working. Add structured evidence.
- **Policy as code** - classifications, retention periods, and lawful bases live in a document. Move them into config the code actually reads.

**3. Remediate.** Delegate to `refactor-worker` with the gap, which obligation it satisfies, whether backwards compatibility is forfeit, every affected store and egress path, and the audit fields required (who, what, when, and **why**).

**4. Verify automatically.** Confirm `refactor-worker` ran lint, types, build, and tests, with authz and DSR paths actually exercised. Delegate to `ux-tester` if consent, DSR self-serve, opt-out, or GPC flows changed.

**5. Validate that the control is real.** This part is yours, and a green test suite does not substitute for it.

- **Access control** - point at one file that answers "who can reach Confidential data." If you cannot, it is not done.
- **Audit trail** - trigger a real mutation. Confirm who, what, when, and why were captured, and that the app cannot edit the log afterward.
- **Deletion** - run one end to end. Primary, replicas, warehouse, log pipelines, object storage exports, backups per retention, notification archives, third parties.
- **Retention** - confirm the job exists, is scheduled, and deletes. Watch it delete something.
- **Opt-out and GPC** - send `Sec-GPC: 1`, confirm it is recorded, confirm downstream sharing paths honor it.
- **Breach detection** - fire a synthetic anomaly, confirm the alert lands inside the SLO that feeds the 72-hour clock.

Anything you did not check is a gap you would be reporting as closed. Say which ones you skipped.

**6. Report and hand off.** Give the user the gap closed, the obligation it maps to, what you actually demonstrated, and what you could not verify. Name the parts that need human judgment: legal copy, DPA signoff, counsel review.

**7. Commit, then reassess.** Have `refactor-worker` strip temporary diagnostics, encourage a commit since the history is itself remediation evidence, then return to step 1 for the next gap.

One gap per cycle, each closed with evidence a reviewer can check.
