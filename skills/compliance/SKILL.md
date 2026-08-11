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

## Terse and Concise

Whether speaking to the user or writing comments, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster.

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

## Agents

**With `Workflow()`,** author the fan-out.

- Fan out with `parallel()`/`pipeline()`; One agent per dimension that actually applies. Skip dimensions belonging to regulations you already scoped out.
- Adjust Agent count to complexity. Choose between 4 to 12 per fan out. Explicitly choose a model:
  - If `switchboard_capabilities` list **Codex**, use Luna for all types of *fan outs* (like Explore/Analyze/Audit/Edits), and Opus for *joins* (Synthesis).
  - Else, use Sonnet for **light** fact checks and exploration, Opus for complex reasoning.
- If **Lexicon** MCP plugin is enabled, have them use it over bare Find/Grep.
- Give each a schema so it returns data, not prose.
- Synthesis: Dedup across dimensions, rank survivors.

Post Workflow triage gate: Real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

Each dimension's checklist is in **Assessment Dimensions** below. Hand each fan-out agent its checklist.

**Without `Workflow()`,** spawn the standing assessor: Agent `team-compliance-assessor` if you are team lead via `CreateTeam`, otherwise Agent `subagent-compliance-assessor`. It cannot see the conversation, so pass the request, the regulatory scope, and what is ruled out. Anything you omit is lost to it.

Spawn Agent `refactor-worker`, `code-analyst`, and `ux-tester` directly via Agent, Task, or runSubagent, picking `team-*` or `subagent-*` by the same rule.

## Assessment Dimensions

Investigate code, config, schema, infra-as-code, third-party integrations, log pipelines, and backup config. A compliance workflow may exist outside this project boundary; determine what actually matters within it. Every finding grounds in evidence, with file paths.

### A. Data Classification (dual axis)

- **Org sensitivity tier**: is every data field classified? Public (public website assets) / Internal (any employee can see: org charts, internal docs) / Confidential (needs-to-know: timesheets, salary, customer PII) / Restricted (secrets, keys, credentials, raw financial data).
- **Regulatory category**: personal data (GDPR Art 4), CPRA SPI, GDPR special category (Art 9). Mapped per field?
- **Dual mapping**: fields that are both (salary = Confidential + personal data) handled correctly on each axis?
- **Where is classification declared**: config? Schema annotation? Scattered assumptions? Nowhere?

### B. Access Control

- **Fine-grained tiers**: enforcement distinct per tier, or all-or-nothing?
- **Centralization**: single policy engine (OPA, Cedar, custom middleware) vs inline checks in every API handler? One-place test: can a reviewer verify the rule by reading a single file?
- **DB-level enforcement**: Row-Level Security, views, or application-layer checks only?
- **Separation of duties**: Restricted tier requires elevated privilege distinct from Confidential access?
- **Service-to-service**: internal calls also classified and scoped, or broad service accounts?

### C. Audit Trails

- **Coverage**: every path mutating Confidential/Restricted data writes to the audit log? Or only the main API while background jobs, admin scripts, and direct DB access bypass it?
- **Fields captured**: who, what, when, and **why** (justification / lawful basis at write time)?
- **Tamper resistance**: append-only? Write-once storage? Separate account or project? Or the same DB a compromised app could edit?
- **Retention of the log itself**: defined, enforced, or indefinite?
- **Readable by reviewer**: structured, queryable, filterable? Or free text a human must grep?

### D. Data Subject Rights (GDPR + CPRA)

- **Deletion (GDPR Art 17, CPRA)**: does deletion actually delete everywhere? Primary DB, read replicas, analytics warehouses, log pipelines, object storage exports, staging/dev clones from prod, backups past their retention, notification archives (email, Slack, webhooks)?
- **Portability (GDPR Art 20)**: machine-readable export?
- **Correction (GDPR Art 16, CPRA)**: self-serve or manual-only? Propagates to derived stores?
- **Right to know (CPRA)**: can the user see what data is held and who it was shared with?
- **Identity verification**: requester verified before any DSR is honored? How?
- **Opt-out of sale/sharing (CPRA)**: implemented? Honored downstream?
- **Global Privacy Control (CPRA)**: `Sec-GPC: 1` honored as opt-out?
- **Limit use of SPI (CPRA)**: can the user restrict SPI processing to necessary purposes?
- **Consent withdrawal (GDPR)**: as easy as giving consent? Propagates to downstream processors?

### E. Lawful Basis and Retention

- **Lawful basis per data category recorded (GDPR Art 6)**: contract, consent, legitimate interest, legal obligation?
- **Retention periods in code or config**, or only in policy docs?
- **A retention job exists and runs**, or is retention aspirational?
- **Retention differentiated by category**: transaction records 7yr, marketing consent revoke-based, logs 90d?

### F. Ghost Data

Retrofit compliance gets killed by ghost data. Check each surface:

- **Analytics warehouses** (Snowflake, BigQuery, Redshift, Mixpanel, Segment): what PII is there? Reached by deletion?
- **Log pipelines** capturing full request/response bodies including PII?
- **Object storage**: CSV exports, data dumps, report artifacts in S3/GCS?
- **Staging/dev loaded from prod dumps**: last refresh? Scrubbed?
- **Backups past retention** still restorable?
- **PII in notifications**: email bodies, Slack webhooks, PagerDuty payloads, Sentry breadcrumbs?
- **Search indexes** (Elasticsearch, Algolia) with copies of PII?
- **Cache layers** with unbounded TTLs?

### G. Code Auditability

- **One-place test on every control**: one file to read, or a grep across handlers? More than one place is broken, regardless of how many.
- **Test coverage for authz**: every rule has a test that fails when the rule is weakened?
- **Config-as-code**: classifications, retention periods, lawful bases, tier mappings declared in version-controlled config, reviewable in PR?
- **Change review**: a policy change leaves a reviewable diff, or is it buried in a prose doc update?

### H. Customer-Facing Controls

- **Self-serve access to own data**, or support ticket only?
- **Self-serve deletion, export, correction?**
- **Consent capture**: granular per purpose? Plain language? No dark patterns?
- **Withdrawal UX**: as easy as opt-in?
- **CPRA opt-out link**: reachable from every page?

### I. Incident and Breach Detection

- **Anomalous access alerting** on Confidential/Restricted tiers?
- **Detection-to-notification path documented**: who gets paged? How does the GDPR 72h clock start?
- **SOC 2 CC7 monitoring**: logging, alerting, incident response runbook?
- **Tabletop evidence**: has the notification path actually been tested?

### J. Third Parties and Subprocessors

- **Inventory**: who receives data? Analytics, payments, email, support, CDN, AI model providers, observability vendors?
- **DPAs in place** with each?
- **Egress the app controls vs does not**: pixel trackers, client-side SDKs phoning home, webhook payloads with PII?
- **Subprocessor list public** (often a GDPR contractual requirement)?

### What Synthesis Returns

**1-5 gaps**, each with:

- Name.
- Regulation citations: SOC 2 CC reference, GDPR article, CPRA section.
- Severity: live violation / audit blocker / control-surface weakness / policy-as-code gap.
- Description, with the evidence seen.
- Impact if not closed, scope, and dependencies.

**ONE recommendation**, with rationale, approach, and implementation notes. Include **reviewer verification**: after it lands, the one file to read, one query to run, or one test to execute that proves the control.

**A ghost data inventory**, always, even when not the recommendation: each surface, whether deletion reaches it, retention, owner.

**A plain answer:** is the app in live violation of any GDPR or CPRA obligation right now? If yes, which?

Rank by:

- **Live violation** first.
- **Blast radius** if discovered by a regulator, customer, or auditor: fine scale, contract loss, public disclosure.
- **Dependency order.** Classification before tier-aware enforcement. Central policy engine before migrating inline checks. Audit log infrastructure before capturing justifications.
- **Unification.** Collapsing N scattered checks into one surface is high value.
- **Ghost data** not reached by deletion is high value, because it silently accumulates risk.

## Procedure

**1. Assess.** Fan out per the Agents section above, scoped to the regulations you established.

You want ranked gaps and one recommendation. Require a plain answer to: what here is a live violation, and what is hardening?

Review with the user before acting on anything.

**2. Pick the approach.** From the recommended gap:

- **Live-violation remediation** - clean break on the offending data path.
- **Control surface build** - the rule is scattered. Build the one place, migrate the call sites, delete the strays.
- **Audit-readiness** - the control works but a reviewer cannot see it working. Add structured evidence.
- **Policy as code** - classifications, retention periods, and lawful bases live in a document. Move them into config the code actually reads.

**3. Remediate.** Delegate to Agent `refactor-worker` with the gap, which obligation it satisfies, whether backwards compatibility is forfeit, every affected store and egress path, and the audit fields required (who, what, when, and **why**).

**4. Verify automatically.** Confirm Agent `refactor-worker` ran lint, types, build, and tests, with authz and DSR paths actually exercised. Delegate to Agent `ux-tester` if consent, DSR self-serve, opt-out, or GPC flows changed.

**5. Validate that the control is real.** This part is yours, and a green test suite does not substitute for it.

- **Access control** - point at one file that answers "who can reach Confidential data." If you cannot, it is not done.
- **Audit trail** - trigger a real mutation. Confirm who, what, when, and why were captured, and that the app cannot edit the log afterward.
- **Deletion** - run one end to end. Primary, replicas, warehouse, log pipelines, object storage exports, backups per retention, notification archives, third parties.
- **Retention** - confirm the job exists, is scheduled, and deletes. Watch it delete something.
- **Opt-out and GPC** - send `Sec-GPC: 1`, confirm it is recorded, confirm downstream sharing paths honor it.
- **Breach detection** - fire a synthetic anomaly, confirm the alert lands inside the SLO that feeds the 72-hour clock.

Anything you did not check is a gap you would be reporting as closed. Say which ones you skipped.

**6. Report and hand off.** Give the user the gap closed, the obligation it maps to, what you actually demonstrated, and what you could not verify. Name the parts that need human judgment: legal copy, DPA signoff, counsel review.

**7. Commit.** Have Agent `refactor-worker` strip temporary diagnostics, then encourage a commit since the history is itself remediation evidence.

One gap per run, closed with evidence a reviewer can check.

If what shipped meaningfully moved the picture, recommend another lap and name what you would look at next. Closing one gap often exposes the next, especially once a control surface exists for others to build on.
