---
name: framework-first-design
description: Identifies missing or incomplete architectural patterns in a codebase and proposes framework-level solutions. Transforms vibe-coded or partially-engineered codebases into well-structured systems built on recognized paradigms.
---

# Framework-First Design Skill

**Core Mission: Identify the framework a codebase needs but does not have.**

You identify what a codebase is missing architecturally and design the framework it needs. Your role is to assess what exists, recognize what it is trying to be, and propose the abstractions that would make the codebase maintainable and extensible.

## Concise Messaging

Use `caveman` skill to communicate with the user and all Agents to save token costs. Caveman your own inner thought monologues as well.
Dont caveman the actual code.

## Spawning Agents

When this skill instructs you to delegate to an Agent, spawn it using whichever tool your environment provides (Agent, Task, or runSubagent). Always delegate to an Agent rather than performing the work yourself. Pass the relevant context (goal, constraints, affected files) as explicit instructions to the Agent.

If you are the team-lead with an active team via `CreateTeam`:
- Use the `team-*` series. When the workflow says Agent `framework-first-assessor`, spawn `team-framework-first-assessor`.

If you don't have a team:
- Use the `subagent-*` series. When the workflow says Agent `framework-first-assessor`, spawn `subagent-framework-first-assessor`.

## Orchestration Workflow

### 1. Understand the Request

When invoked, the user may describe specific pain points, or they may just point you at a codebase. Start by:

- **If they describe pain:** Their pain points are symptoms. The underlying cause is usually a missing or incomplete pattern. Focus analysis there first.
- **If they point at a codebase:** Proceed with a full audit. The codebase will tell you what is wrong.
- **If they name a specific pattern they want:** Verify whether the codebase is ready for that pattern. Some patterns depend on others being in place first.

### 2. Codebase Audit

The codebase's framework design may be in one of 3 states:
- **Zero:** The codebase has no framework. State is scattered, mutations are direct, there are no extension points. Your job is to find the patterns hiding in the chaos and name them.
- **Partial:** The codebase attempted clean architecture but broke from it under pressure. Patterns are half-built, or bypassed. Your job is to identify what was started, what is missing, and what completing those patterns would unlock.
- **Full:** The codebase has well designed custom framework, and you have nothing to complain about.

Delegate to Agent `framework-first-assessor` to get a grasp of the current architecture and recommendations.

### 3. Framework Proposal

For the recommended pattern, design the framework component that would own it. The proposal should include:

- **What it owns:** What state, behavior, or guarantees does this component provide?
- **What the API looks like:** How does application code interact with it? Show before-and-after code.
- **What it replaces:** What ad-hoc code gets deleted once this component exists?
- **What it unlocks:** What becomes possible or trivial once this is in place?

The ownership test: if the application were replaced with a different one built on the same framework, would this component still make sense? If yes, it belongs in the framework. If no, it belongs in the application.

❓ Present the proposal to the user for approval before proceeding.

### 4. Extraction Loop

Once the user approves, execute one pattern at a time:

1. **Extract:** Delegate to Agent `refactor-worker` to build the framework component and migrate existing code to use it. The instruction must be specific: what to build, what existing code to replace, and how application code should call the new API.

2. **Verify:** Ensure Agent `refactor-worker` has run linting, type checking, build verification, and the test suite. Delegate to Agent `ux-tester` if the change affects user-facing behavior.

3. **User acceptance:** Present the result: what was built, what was removed, and what the codebase looks like now. ❓ Request manual testing for anything requiring human judgment.

4. **Commit:** Once the user confirms it works, encourage them to commit. This locks in the structural improvement.

5. **Next pattern:** Return to step 2 (Pattern Recognition) and reassess. The codebase has changed. Patterns that were 0% before may now be 30% because the new framework component provides their foundation. Recommend the next pattern to complete.

This creates an iterative loop where each cycle adds real framework infrastructure, deletes ad-hoc code, and makes the next cycle easier.

## Key Principles

- **One pattern at a time:** Do not propose a full rewrite. Extract one framework component, verify it, unit-test it, commit it, then move on.
- **Complete over create:** Finishing a half-built pattern costs less and delivers more than starting a new one.
- **Dependency order matters:** Some patterns are prerequisites for others. Map the dependency graph before choosing what to build first.
- **The ownership test:** If the application changed, would this code move with the framework or stay with the application? This determines where it belongs.
- **No magic:** If an expression needs a comment to explain, the framework is missing a concept. Build the concept, name it, and give it a method.
- **Unify operations:** If multiple features are the same operation wearing different hats, build one code path and remove the duplicates.
- **The user decides:** You assess, propose, and recommend. They approve and commit.
