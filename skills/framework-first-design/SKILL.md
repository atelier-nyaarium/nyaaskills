---
name: framework-first-design
description: Identifies missing or incomplete architectural patterns in a codebase and proposes framework-level solutions. Transforms vibe-coded or partially-engineered codebases into well-structured systems built on recognized paradigms.
---

# Framework-First Design Skill

**Core Mission: Identify framework a codebase needs but does not have.**

You identify what codebase is missing architecturally and design framework it needs. Your role: assess what exists, recognize what it tries to be, propose abstractions that would make codebase maintainable and extensible.

## Engineering Standard

Highest quality only. "Overkill" is not a valid objection. Design well once so we never sit at THIS drawing board again. Reject "good enough." Reject patches that mask structural defects. Choose paradigm that fits the domain, not the one that ships fastest.

The bar: **eliminate bugs by design, not by patching.** Correct framework makes whole classes of bug impossible to express.

## Concise Messaging

Use /caveman skill to communicate with user and all Agents to save token costs. Caveman your own inner thought monologues too. Don't prefix the sentence with "caveman" though.

Don't caveman actual code.

## Spawning Agents

When this skill instructs you to delegate to Agent, spawn using whichever tool your environment provides (Agent, Task, or runSubagent). Always delegate to Agent rather than performing work yourself. Pass relevant context (goal, constraints, affected files) as explicit instructions to Agent.

If you are team-lead with active team via `CreateTeam`:
- Use `team-*` series. When workflow says Agent `framework-first-assessor`, spawn `team-framework-first-assessor`.

If you don't have team:
- Use `subagent-*` series. When workflow says Agent `framework-first-assessor`, spawn `subagent-framework-first-assessor`.

## Understand the Request

When invoked, user may describe specific pain points, or may just point you at codebase. Start by:

- **If they describe pain:** Pain points are symptoms. Underlying cause usually missing or incomplete pattern. Focus analysis there first.
- **If they point at codebase:** Proceed with full audit. Codebase will tell you what is wrong.
- **If they name specific pattern they want:** Verify whether codebase is ready for that pattern. Some patterns depend on others being in place first.

## Orchestration Workflow

### 0. Recall Pain Points

If you've been working with the codebase prior to this audit, think of pain points you've experienced this session:

- The same bugs you ran into and bandaided multiple times in a row.
- Fragile design that you had to carefully tread around, or brute force by user or unit test acceptance.
- Code, comment, docs, or even AI/CLAUDE.md rules that just don't make sense anymore.
- Anything else that bothered you about the codebase.

Forward all detailed concerns to the assessor that you will spawn.

### 1. Assessment Phase

Delegate to Agent `framework-first-assessor` to grasp current architecture and recommendations.

Assessor will:
- Identify architectural patterns currently in use, and how well they are implemented
- Recognize patterns that codebase is trying to be but isn't fully realized
- Detect anti-patterns
- Present list of 1-5 architectural improvements
- Recommend ONE pattern to handle now

### 2. Framework Proposal

For recommended pattern, design framework component that would own it. Proposal should include:

- **What it owns:** What state, behavior, or guarantees does this component provide?
- **What the API looks like:** How does application code interact with it? Show before-and-after code.
- **What it replaces:** What ad-hoc code gets deleted once this component exists?
- **What it unlocks:** What becomes possible or trivial once this is in place?

Ownership test: if application were replaced with different one built on same framework, would this component still make sense? If yes, belongs in framework. If no, belongs in application.

❓ Present proposal to user for approval before proceeding.

### 3. Extraction Loop

Once user approves, execute one pattern at a time:

1. **Extract:** Delegate to Agent `refactor-worker` to build framework component and migrate existing code to use it. Instruction must be specific: what to build, what existing code to replace, how application code should call new API.

2. **Verify:** Ensure Agent `refactor-worker` ran linting, type checking, build verification, and test suite. Delegate to Agent `ux-tester` if change affects user-facing behavior.

3. **User acceptance:** Present result: what was built, what was removed, what codebase looks like now. ❓ Request manual testing for anything requiring human judgment.

4. **Commit:** Once user confirms it works, encourage them to commit. Locks in structural improvement.

5. **Next pattern:** Return to step 2 (Pattern Recognition) and reassess. Codebase changed. Patterns that were 0% before may now be 30% because new framework component provides their foundation. Recommend next pattern to complete.

Creates iterative loop where each cycle adds real framework infrastructure, deletes ad-hoc code, makes next cycle easier.

## Key Principles

- **One pattern at a time** - Do not propose full rewrite. Extract one framework component, verify it, unit-test it, commit it, then move on.
- **Complete over create** - Finishing half-built pattern costs less and delivers more than starting new one.
- **Dependency order matters** - Some patterns are prerequisites for others. Map dependency graph before choosing what to build first.
- **The ownership test** - If application changed, would this code move with framework or stay with application? Determines where it belongs.
- **No magic** - If expression needs comment to explain, framework missing a concept. Build concept, name it, give it method.
- **Unify operations** - If multiple features are same operation wearing different hats, build one code path and remove duplicates.
- **Bugs impossible by design** - Goal is not fewer bugs, it is bug classes that cannot be expressed in the new code. If pattern only reduces bug likelihood, keep designing.
- **Design once, not twice** - We are at this drawing board now so we never return to it. Pay upfront cost of right paradigm. Half-measures guarantee a second visit.
- **The user decides** - You assess, propose, recommend. They approve and commit.
