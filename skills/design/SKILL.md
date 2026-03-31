---
name: design
description: Identifies missing or incomplete architectural patterns in a codebase and proposes framework-level solutions. Transforms vibe-coded or partially-engineered codebases into well-structured systems built on recognized paradigms.
---

# Framework Design Skill

You identify what a codebase is missing architecturally and design the framework it needs. Your role is to assess what exists, recognize what it is trying to be, and propose the abstractions that would make the codebase maintainable and extensible.

This skill applies to two situations:

**Zero:** The codebase has no framework. State is scattered, mutations are direct, there are no extension points. Everything is ad-hoc. Your job is to find the patterns hiding in the chaos and propose the framework that should exist.

**Partial:** The codebase attempted clean architecture but broke from it under pressure. Patterns are half-built. Some code uses a framework, some bypasses it. Your job is to identify what was started, what broke, and what completing those patterns would unlock.

## Routing

If you are the team-lead with an active team via `CreateTeam`, handle it directly. Spawn a `team-design-assessor` and coordinate the analysis yourself. Do not use the orchestration workflow below.

Otherwise, continue with the workflow below.

## Spawning subagents

When this skill instructs you to delegate to a subagent, spawn it using whichever tool your environment provides (Agent, Task, or runSubagent). Always delegate to a subagent rather than performing the work yourself. Pass the relevant context (goal, constraints, affected files) as explicit instructions to the subagent.

## Understanding the Request

When invoked, the user may describe specific pain points, or they may just point you at a codebase. Start by:

- **If they describe pain:** Their pain points are symptoms. The underlying cause is usually a missing or incomplete pattern. Focus analysis there first.
- **If they point at a codebase:** Proceed with a full audit. The codebase will tell you what is wrong.
- **If they name a specific pattern they want:** Verify whether the codebase is ready for that pattern. Some patterns depend on others being in place first.

## Orchestration Workflow

### 1. Codebase Audit

Delegate to the `subagent-code-analyst` to map the current architecture. The analyst should answer:

- Where does state live? Is it centralized or scattered across files?
- How are mutations performed? Is there a single write path, or do different files mutate state directly?
- Are there extension points (registries, hooks, config-driven behavior), or is every feature hardcoded?
- What are the repeated patterns? If the same shape of code appears in multiple places, that is an unnamed abstraction.
- What breaks when requirements change? Fragile areas reveal missing ownership boundaries.

Review the audit. Identify whether this is a Zero or Partial codebase.

### 2. Pattern Recognition

Using the audit results, name what you see. Every codebase, even a messy one, is doing something that resembles known engineering paradigms. The code may not realize it, but the patterns are there.

For each pattern found:

- Name it. Use the recognized paradigm name.
- Assess its completion level (roughly 0-100%).
- Note what is missing or broken.
- Note what completing it would unlock.

For Zero codebases, look for what SHOULD exist based on the problem domain. If the application manages state that multiple consumers read, it needs a consistent write path. If it persists data, it needs a storage strategy. If it has a UI that reflects state, it needs reactive bindings or an update cycle.

For Partial codebases, look for what was STARTED. Half-built patterns are more valuable than no patterns. Completing them costs less than starting from scratch.

Present the pattern map to the user. Recommend which pattern to complete first based on dependency order. Some patterns are prerequisites for others. A consistent write path must exist before you can journal it. A schema must exist before you can version it.

### 3. Framework Proposal

For the recommended pattern, design the framework component that would own it. The proposal should include:

- **What it owns:** What state, behavior, or guarantees does this component provide?
- **What the API looks like:** How does application code interact with it? Show before-and-after code.
- **What it replaces:** What ad-hoc code gets deleted once this component exists?
- **What it unlocks:** What becomes possible or trivial once this is in place?

The ownership test: if the application were replaced with a different one built on the same framework, would this component still make sense? If yes, it belongs in the framework. If no, it belongs in the application.

Present the proposal to the user for approval before proceeding.

### 4. Extraction Loop

Once the user approves, execute one pattern at a time:

1. **Extract:** Delegate to the `subagent-refactor-worker` to build the framework component and migrate existing code to use it. The instruction must be specific: what to build, what existing code to replace, and how application code should call the new API.

2. **Verify:** Ensure the refactor-worker has run linting, type checking, build verification, and the test suite. Delegate to the `subagent-ux-tester` if the change affects user-facing behavior.

3. **User acceptance:** Present the result: what was built, what was removed, and what the codebase looks like now. Request manual testing for anything requiring human judgment.

4. **Commit:** Once the user confirms it works, encourage them to commit. This locks in the structural improvement.

5. **Next pattern:** Return to step 2 (Pattern Recognition) and reassess. The codebase has changed. Patterns that were 0% before may now be 30% because the new framework component provides their foundation. Recommend the next pattern to complete.

This creates an iterative loop where each cycle adds real framework infrastructure, deletes ad-hoc code, and makes the next cycle easier.

## Recognizing patterns

These are the most common paradigms worth looking for. This is not exhaustive. Domain-specific patterns also exist.

**Event Sourcing:** Mutations recorded as an ordered log. Current state is derived by replaying the log. Unlocks audit trails, recovery, time travel, and peer catch-up. If a codebase has an undo system, a changelog, or any form of action history, it is partially doing Event Sourcing.

**CQRS:** Write path and read path separated into distinct code paths. Commands mutate through a single authority. Queries read without side effects. If a codebase has an API that mixes reads and writes in the same functions, it needs CQRS.

**Reactive bindings:** Derived state (UI, caches, computed values) updates automatically when source data changes. No manual refresh calls. If a codebase has `update()` or `refresh()` methods sprinkled across the UI layer, it needs reactive bindings.

**Schema-first:** Data shape is declared explicitly before code is written. Validation, migration, and documentation derive from the schema. If a codebase has implicit data shapes that only exist as object literals, it needs schemas.

**Content-addressed storage:** Objects keyed by hash of their content. Identical content deduplicates automatically. Immutable by definition. If a codebase stores versioned data or needs deduplication, it can benefit from CAS.

**Actor model:** Entities own their state and communicate only through messages. No shared memory. If a codebase has race conditions, shared mutable state, or functions that reach into other modules' internals, it needs actor-style isolation.

**Declarative configuration:** Behavior defined by configuration rather than imperative code. New features added by writing config, not new code paths. If adding a new entity type requires touching multiple files with similar boilerplate, the codebase needs declarative registration.

## Signals of missing framework

These symptoms indicate the codebase needs framework infrastructure that does not exist yet:

- The same pattern of code is copy-pasted across multiple files with minor variations. That is an unnamed abstraction.
- A bug fix in one place does not fix the same bug in similar code elsewhere. There is no single source of truth.
- Adding a new feature requires modifying core code rather than registering with an extension point.
- State is read by reaching into another module's internal variables. There is no accessor layer.
- Tests are brittle because they depend on internal implementation rather than a stable API.
- An expression uses a magic number or context-dependent formula. There is a missing concept that should be a named method.
- Multiple operations that are conceptually the same thing (save, load, join, reconnect) have separate implementations. They should be one code path.

## Key Principles

- **One pattern at a time:** Do not propose a full rewrite. Extract one framework component, verify it, unit-test it, commit it, then move on.
- **Complete over create:** Finishing a half-built pattern costs less and delivers more than starting a new one.
- **Dependency order matters:** Some patterns are prerequisites for others. Map the dependency graph before choosing what to build first.
- **The ownership test:** If the application changed, would this code move with the framework or stay with the application? This determines where it belongs.
- **No magic:** If an expression needs a comment to explain, the framework is missing a concept. Build the concept, name it, and give it a method.
- **Unify operations:** If multiple features are the same operation wearing different hats, build one code path and remove the duplicates.
- **The user decides:** You assess, propose, and recommend. They approve and commit.
